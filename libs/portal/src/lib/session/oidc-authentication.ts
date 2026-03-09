import Keycloak, { KeycloakInstance } from "keycloak-js";
import { Authentication, Session } from "./authentication";
import { SessionManager } from "./session-manager";

export interface OIDCUser {
  sub: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  roles?: string[];
  [prop: string]: any;
}

export interface OIDCTicket {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
}

export class OIDCAuthentication implements Authentication<any, OIDCUser, OIDCTicket> {
  // instance data

  private keycloak: KeycloakInstance;

  // constructor

  constructor(config: {
    url: string;
    realm: string;
    clientId: string;
  }) {
    this.keycloak = new (Keycloak as any)(config);
  }

  // implement

  async start(): Promise<Session<OIDCUser, OIDCTicket> | null> {
     await this.keycloak.init({
      onLoad: 'check-sso',
      flow: 'standard',
      checkLoginIframe: false,
    });

    if (!this.keycloak.authenticated) {
      return null;
    }

    return this.buildSession();
  }

  async login(): Promise<Session<OIDCUser, OIDCTicket>> {
    // Redirect to login
    await this.keycloak.login({
      redirectUri: window.location.href,
    });

    // In OIDC standard flow this line is never reached
    throw new Error('Redirecting for OIDC login');
  }

  async logout(): Promise<void> {
    await this.keycloak.logout({
      redirectUri: window.location.origin,
    });
  }

  // private

  private buildSession(): Session<OIDCUser, OIDCTicket> {
    return {
      user: this.keycloak.idTokenParsed as OIDCUser,
      ticket: {
        accessToken: this.keycloak.token!,
        refreshToken: this.keycloak.refreshToken,
        idToken: this.keycloak.idToken,
      },
      expiry: this.keycloak.tokenParsed?.exp
        ? this.keycloak.tokenParsed.exp * 1000
        : undefined,
        sessionLocals: {}
    };
  }
}

export type OIDCSessionManager = SessionManager<OIDCUser, OIDCTicket>;