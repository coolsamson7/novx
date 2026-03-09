import { Subject } from "rxjs";
import { Authentication, Session } from "./authentication";

/**
 * covers the possible session events
 */
export interface SessionEvent<U=any,T=any> {
    type: "opening" | "opened" | "closing" | "closed"
    session: Session<U,T>
}

/**
 * A `SessionManager` manages the session state.
 */
export class SessionManager<R=any, U = any, T=any> {
  /**
   * observable for session events
   */
  public readonly events$ = new Subject<SessionEvent<U, T>>();

  private session: Session<U, T> | null = null;

  // constructor

  /**
   * Create a new `SessionManager`
   * @param authentication the authentication
   */
  constructor(protected authentication: Authentication<R, U, T>) {}

  // public 

  /**
   * give the {@link Authentication} the chance to satrtup and to return any valid session
   * @returns a possible session
   */
  async start(): Promise<Session<U, T> | null> {
    const restored = await this.authentication.start();

    if (restored) {
      this.setSession(restored);
    }

    return this.session;
  }

  /**
   * 
   * @returns return `true`, if there is an active session, `false` otherwise
   */
  hasSession(): boolean {
    return this.session !== null;
  }

  /**
   * return the active session
   * @returns return the active session
   */
  currentSession(): Session<U, T> {
    if (!this.session) {
      throw new Error('No active session');
    }
    return this.session;
  }

  /**
   * 
   * @param request open a session given request data.
   * @returns a session
   */
  async openSession(request : R): Promise<Session<U, T>> {
    const session = await this.authentication.login(request);
    this.setSession(session);

    return session;
  }

  /**
   * close the active session
   */
  async closeSession(): Promise<void> {
    await this.authentication.logout();
    
    this.clearSession();
  }

  /**
   * set a session value
   * @param key a local key
   * @param value a value
   */
  setSessionLocal(key: string, value: any) {
    this.currentSession().sessionLocals[key] = value
  }

  /**
   * retieve a session local
   * @param key the key
   * @returns  the value
   */
  getSessionLocal(key: string) {
    return this.currentSession().sessionLocals[key]
  }

  // protected

  protected setSession(session: Session<U, T>) {
    this.session = session;

    this.events$.next({ type: 'opened', session });
  }

  protected clearSession() {
    const session = this.session

    this.session = null;
    this.events$.next({ type: 'closed', session: session! });
  }
}