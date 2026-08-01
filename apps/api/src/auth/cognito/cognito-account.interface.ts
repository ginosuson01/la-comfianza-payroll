export interface CreateCognitoAccountInput {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile?: string;
}

export interface CreatedCognitoAccount {
  sub: string;
  username: string;
  status?: string;
}
