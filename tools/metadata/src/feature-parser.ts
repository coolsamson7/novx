import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import ts from "typescript";

import { FeatureMetadata, ModuleMetadata } from "@novx/portal";

export class FeatureMetadataParser {
  private program: ts.Program;
  private checker: ts.TypeChecker;

  constructor(private tsconfigPath: string) {
    if (!fs.existsSync(tsconfigPath)) {
      throw new Error(`tsconfig not found: ${tsconfigPath}`);
    }

    const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    const baseParsedConfig = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.dirname(tsconfigPath)
    );

    const parsedConfig = {
      ...baseParsedConfig,
      options: {
        ...baseParsedConfig.options,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    };

    this.program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
      projectReferences: parsedConfig.projectReferences,
    });

    this.checker = this.program.getTypeChecker();
  }

  parseDirectory(dirPath: string): ModuleMetadata[] {
    const modules: ModuleMetadata[] = [];
    const files = glob.sync(`${dirPath}/**/*.ts{,x}`, { ignore: "**/node_modules/**" });

    let foundModuleMetadata: ModuleMetadata | null = null;
    const allFeatures: FeatureMetadata[] = [];

    // First pass: look for @Module decorator
    for (const file of files) {
      const filePath = path.resolve(file);
      let sourceFile = this.program.getSourceFile(filePath);
      
      // If not found in program, create one directly with proper compiler options
      if (!sourceFile) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        sourceFile = ts.createSourceFile(
          filePath,
          fileContent,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX // Force TSX parsing
        );
      }
      
      const moduleMetadata = this.parseSourceFileForModule(sourceFile);
      if (moduleMetadata) {
        foundModuleMetadata = moduleMetadata;
        break;
      }
    }

    // Second pass: collect all @Feature decorated items
    for (const file of files) {
      const filePath = path.resolve(file);
      let sourceFile = this.program.getSourceFile(filePath);
      
      // If not found in program, create one directly with proper compiler options
      if (!sourceFile) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        sourceFile = ts.createSourceFile(
          filePath,
          fileContent,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX // Force TSX parsing
        );
      }

      const features = this.collectFeaturesFromSourceFile(sourceFile);
      allFeatures.push(...features);
    }

    // If we found a @Module, use it; otherwise create a default one
    const moduleMetadata = foundModuleMetadata || {
      id: path.basename(dirPath),
      label: path.basename(dirPath),
      version: "1.0.0",
      moduleName: path.basename(dirPath),
      sourceFile: "",
    };

    // Build parent-child relationships and tree structure
    const featuresWithTree = this.buildFeatureTree(allFeatures);
    moduleMetadata.features = featuresWithTree;
    modules.push(moduleMetadata);

    return modules;
  }

  private parseSourceFileForModule(sourceFile: ts.SourceFile): ModuleMetadata | null {
    let foundModule: ModuleMetadata | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        const decorators = ts.getDecorators(node) || [];
        for (const decorator of decorators) {
          let decoratorName: string;
          let decoratorArgs: ts.NodeArray<ts.Expression> = ts.factory.createNodeArray();

          if (ts.isCallExpression(decorator.expression)) {
            decoratorName = decorator.expression.expression.getText(sourceFile);
            decoratorArgs = decorator.expression.arguments;
          } else if (ts.isIdentifier(decorator.expression)) {
            decoratorName = decorator.expression.getText(sourceFile);
          } else continue;

          if (decoratorName === "Module" || decoratorName === "FeatureModule") {
            if (foundModule)
              throw new Error(
                `Multiple @Module decorators found in ${sourceFile.fileName}`
              );

            const moduleData: ModuleMetadata = {
              id: "",
              label: "",
              version: "",
              features: [],
              moduleName:
                node.name?.getText(sourceFile) || path.basename(sourceFile.fileName, ".ts"),
              sourceFile: path.relative(process.cwd(), sourceFile.fileName),
            };

            if (
              decoratorArgs.length > 0 &&
              ts.isObjectLiteralExpression(decoratorArgs[0])
            ) {
              Object.assign(
                moduleData,
                this.parseObjectLiteral(decoratorArgs[0], sourceFile)
              );
            }

            foundModule = moduleData;
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return foundModule;
  }

  private collectFeaturesFromFolder(folderPath: string): FeatureMetadata[] {
    const features: FeatureMetadata[] = [];
    const files = glob.sync(`${folderPath}/**/*.ts{,x}`, { ignore: "**/node_modules/**" });

    for (const file of files) {
      const sourceFile = this.program.getSourceFile(path.resolve(file));
      if (!sourceFile) continue;

      const fileFeatures = this.collectFeaturesFromSourceFile(sourceFile);
      features.push(...fileFeatures);
    }

    return features;
  }

  private collectFeaturesFromSourceFile(sourceFile: ts.SourceFile): FeatureMetadata[] {
    const features: FeatureMetadata[] = [];

    ts.forEachChild(sourceFile, node => {
      // Support both class and function declarations
      const isClass = ts.isClassDeclaration(node);
      const isFunction = ts.isFunctionDeclaration(node);

      if (!isClass && !isFunction) return;

      const nodeName = node.name?.getText(sourceFile);
      
      // Get decorators using the correct API
      let decorators: readonly ts.Decorator[] = [];
      if (isClass && ts.isClassDeclaration(node)) {
        decorators = ts.getDecorators(node) || [];
      }

      // Fallback: also check node.decorators directly
      if (decorators.length === 0) {
        decorators = (node as any).decorators || [];
      }
      
      for (const decorator of decorators) {
        let decoratorName: string;
        let decoratorArgs: ts.NodeArray<ts.Expression> = ts.factory.createNodeArray();

        if (ts.isCallExpression(decorator.expression)) {
          decoratorName = decorator.expression.expression.getText(sourceFile);
          decoratorArgs = decorator.expression.arguments;
        } else if (ts.isIdentifier(decorator.expression)) {
          decoratorName = decorator.expression.getText(sourceFile);
        } else continue;

        // Only recognize @Feature decorator
        if (decoratorName === "Feature") {
          const metadata: FeatureMetadata = {
            id: "",
            label: "",
            path: "",
            component: nodeName || "Unknown",
            sourceFile: path.relative(process.cwd(), sourceFile.fileName),
          };

          if (
            decoratorArgs.length > 0 &&
            ts.isObjectLiteralExpression(decoratorArgs[0])
          ) {
            Object.assign(
              metadata,
              this.parseObjectLiteral(decoratorArgs[0], sourceFile)
            );
          }

          // If component name is provided in decorator, use it; otherwise use function/class name
          if (!metadata.component || metadata.component === "Unknown") {
            metadata.component = nodeName || "Unknown";
          }

          if (!metadata.sourceFile) {
            metadata.sourceFile = path.relative(process.cwd(), sourceFile.fileName);
          }

          features.push(metadata);
        }
      }
    });

    return features;
  }

  private parseObjectLiteral(obj: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile): Record<string, any> {
    const result: Record<string, any> = {};
    for (const property of obj.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = property.name.getText(sourceFile);
        const value = this.evaluateExpression(property.initializer, sourceFile);
        result[name] = value;
      }
    }
    return result;
  }

  /**
   * Build parent-child tree structure from flat list of features
   */
  private buildFeatureTree(features: FeatureMetadata[]): FeatureMetadata[] {
    // Create a map for quick lookup
    const featureMap = new Map<string, FeatureMetadata>();
    const rootFeatures: FeatureMetadata[] = [];

    // First pass: create map and initialize children arrays
    for (const feature of features) {
      feature.children = [];
      featureMap.set(feature.id, feature);
    }

    // Second pass: build parent-child relationships
    for (const feature of features) {
      if (feature.parent) {
        // This feature has a parent
        const parentFeature = featureMap.get(feature.parent);
        if (parentFeature) {
          // Add to parent's children
          if (!parentFeature.children) {
            parentFeature.children = [];
          }
          parentFeature.children.push(feature);
          console.log(`📁 Added child feature "${feature.id}" to parent "${feature.parent}"`);
        } else {
          console.warn(`⚠️  Parent feature "${feature.parent}" not found for "${feature.id}". Adding as root feature.`);
          rootFeatures.push(feature);
        }
      } else {
        // This is a root feature
        rootFeatures.push(feature);
      }
    }

    console.log(`🌳 Feature tree built: ${rootFeatures.length} root features`);
    return rootFeatures;
  }

  private evaluateExpression(expr: ts.Expression, sourceFile: ts.SourceFile): any {
    if (ts.isStringLiteral(expr)) return expr.text;
    if (ts.isNumericLiteral(expr)) return Number(expr.text);
    if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isArrayLiteralExpression(expr))
      return expr.elements.map(el => this.evaluateExpression(el, sourceFile));
    if (ts.isObjectLiteralExpression(expr))
      return this.parseObjectLiteral(expr, sourceFile);
    return expr.getText(sourceFile).replace(/['"]/g, "");
  }
}

export class FeatureMetadataScanner {
  static scanModuleFolder(moduleFolderPath: string): ModuleMetadata {
    // detect tsconfig.app.json automatically
    const tsconfigCandidates = [
      path.join(moduleFolderPath, "tsconfig.app.json"),
      path.join(moduleFolderPath, "tsconfig.json"),
    ];

    const tsconfigPath = tsconfigCandidates.find(fs.existsSync);
    if (!tsconfigPath) {
      throw new Error(
        `No tsconfig.app.json or tsconfig.json found in ${moduleFolderPath}`
      );
    }

    const parser = new FeatureMetadataParser(tsconfigPath);
    const modules = parser.parseDirectory(moduleFolderPath);

    if (modules.length === 0)
      throw new Error(`No @Module found in ${moduleFolderPath}`);

    if (modules.length > 1)
      throw new Error(`Multiple @Module found in ${moduleFolderPath}`);

    return modules[0];
  }

  static exportToJSON(data: ModuleMetadata, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`✅ Module metadata exported to ${outputPath}`);
  }

  static updateWebpackConfig(
    data: ModuleMetadata,
    webpackConfigPath: string
  ): void {
    if (!fs.existsSync(webpackConfigPath)) {
      console.warn(`⚠️  Webpack config not found: ${webpackConfigPath}`);
      return;
    }

    // Read the webpack config file
    let configContent = fs.readFileSync(webpackConfigPath, "utf-8");

    // Build the exposes object from feature metadata
    const exposes: Record<string, string> = {};

    // expose the module itself
    if (data.moduleName && data.sourceFile) {
      const modulePath = data.sourceFile.replace(/\.tsx?$/, "");
      exposes[`./Module`] = `./${modulePath}`;
    }

    // expose all features
    if (data.features) {
      for (const feature of data.features) {
        const componentName = feature.component;
        const sourceFilePath = feature.sourceFile?.replace(/\.tsx?$/, "") || "";

        if (componentName && sourceFilePath) {
          exposes[`./${componentName}`] = `./${sourceFilePath}`;
        }
      }
    }

    // Generate the exposes section as a string
    const exposesLines = Object.entries(exposes).map(
      ([key, value]) => `        "${key}": "${value}",`
    );
    const exposesString = exposesLines.join("\n");

    // Replace the exposes section in the webpack config
    // Match: exposes: { ... } with any content inside
    const exposesRegex = /exposes:\s*\{[^}]*\}/s;

    if (exposesRegex.test(configContent)) {
      configContent = configContent.replace(
        exposesRegex,
        `exposes: {\n${exposesString}\n      }`
      );

      fs.writeFileSync(webpackConfigPath, configContent, "utf-8");
      console.log(`✅ Webpack config updated: ${webpackConfigPath}`);
    } else {
      console.warn(`⚠️  Could not find 'exposes' section in ${webpackConfigPath}`);
    }
  }
}
