import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from "axios";
import {injectable, Providers, Constructor, TypeDescriptor} from "@novx/core";

import {Serialization} from "./serialization";

export class EndpointLocator {
  /**
   * return a base url for server callss
   * @param domain a domain name )
   */
  getEndpoint(domain: string): string {
    throw new Error("implement getEndpoint");
  }
}

export interface RuleConfig {
  match: string;
  url: string;
}

interface Rule {
  match: RegExp;
  url: string;
}

export class PatternEndpointLocator extends EndpointLocator {
  // instance data

  private rules: Rule[];

  // constructor

  constructor(...rules: RuleConfig[]) {
    super();

    this.rules = rules.map((rule) => {
      return { match: new RegExp(rule.match), url: rule.url };
    });
  }

  // override EndpointLocator

  override getEndpoint(domain: string): string {
    for (const rule of this.rules) if (rule.match.test(domain)) return rule.url;

    throw new Error("no match");
  }
}

export abstract class AxiosBuilder {
  abstract create(domain: string, url: string): AxiosInstance;
}

export interface AxiosDecorator {
  decorate(domain: string, instance: AxiosInstance): void;
}

@injectable() // TODO move
class DefaultAxiosBuilder extends AxiosBuilder {
  create(domain: string, url: string): AxiosInstance {
    return axios.create({
      baseURL: url,
    });
  }
}

/**
 * <code>HttpFactory</code> creates and caches Axios instances that are used for communication.
 */
@injectable()
export class HTTPFactory {
  // instance data

  private instances: { [url: string]: AxiosInstance } = {};
  private decorator: AxiosDecorator | undefined;

  // constructor

  constructor(private endpointLocator: EndpointLocator, private builder: AxiosBuilder) {}

  // public

  setDecorator(decorator: AxiosDecorator): HTTPFactory {
    this.decorator = decorator;

    return this;
  }

  /**
   * retrieve an <code>AxiosInstance</code> given domain name.
   * @param domain the business domain of the corresponding service
   */
  get(domain: string): AxiosInstance {
    const url = this.endpointLocator.getEndpoint(domain);
    let instance = this.instances[url];
    if (!instance) {
      this.instances[url] = instance = this.builder.create(domain, url);

      this.decorator?.decorate(domain, instance);
    } // if

    return instance;
  }
}

/**
 * registers the service to relate to a specific domain.
 * @param domain the domain name
 * @constructor
 */
export function service(domain: string): any {
    return function (clazz: Constructor<AbstractService>) {
        TypeDescriptor.forType(clazz).addDecorator(service)

        Providers.registerClass("", clazz);

        Reflect.set(clazz, "$$domain", domain)
    }
}

export abstract class AbstractService {
  // instance data

  protected http: AxiosInstance;

  // constructor

  protected constructor(factory : HTTPFactory) {
    this.http = factory.get(this.getDomain());
  }

  // protected

  get<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
        return this.http.get(url, {
            ...config,
            headers: config?.headers || {
                "Accept": "application/json, */*;q=0.8"
            }
        })
  }

  post<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
        return this.http.post(url, data, {
            ...config,
            headers: config?.headers || {
                "Accept": "application/json, */*;q=0.8"
            }
        })
  }

  put<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
        return this.http.put(url, data, {
            ...config,
            headers: config?.headers || {
                "Accept": "application/json, */*;q=0.8"
            }
        })
  }

  delete<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
        return this.http.delete(url, {
            ...config,
            headers: config?.headers || {
                "Accept": "application/json, */*;q=0.8"
            }
        })
  }

  patch<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
        return this.http.patch(url, data, {
            ...config,
            headers: config?.headers || {
                "Accept": "application/json, */*;q=0.8"
            }
        })
  }

  request<T = any, R = AxiosResponse<T>, D = any>(config: AxiosRequestConfig<D>): Promise<R> {
        return this.http.request({
            ...config,
            headers: config?.headers || {
                "Accept": "application/json, */*;q=0.8"
            }
        })
  }

  serialize<T>(type: string, format: string, value: T): any {
      return Serialization.serialization(type).serialize(format, value)
  }

  deserialize<T>(type: string, format: string, value: any): T {
        return Serialization.serialization(type).deserialize(format, value) as T
  }


  // private

  private getDomain(): string {
    return (this.constructor as any)["$$domain"] || "";
  }
}


