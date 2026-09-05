import { apiClient } from './client';
import { LoginResponse, User } from '../types/auth';

export interface LoginPayload {
  username: string;
  password: string;
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  return apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<User> {
  return apiClient<User>('/auth/me', {
    method: 'GET',
  });
}
