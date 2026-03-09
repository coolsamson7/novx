


/**
 * A `Session` captures the data of a logged in user and cooresponding technical information
 * in the form of a ticket ( e.g. tokens, expire date, ... )
 * @params U the user type
 * @params T the ticket type
 */
export interface Session<U = any, T = any> {
  user: U;
  ticket: T;
  expiry?: number;
  locale?: string;

  sessionLocals: Record<string,any>
}

/**
 *  `Authentication` is repsonsible to establish and delete a user session.
 * @param R any information requires to trigger the login
 * @params U the user type
 * @params T the ticket type
 */
export interface Authentication<R = any, U = any, T = any> {
  /**
   * setup the authentication and possibly restore a valid session.
   */
  start(): Promise<Session<U, T> | null>;

  /**
   * request a session
   * @param request any request information.
   * @returns a valid session
   */
  login(request: R): Promise<Session<U, T>>;

  /**
   * logout
   */
  logout(): Promise<void>;
}