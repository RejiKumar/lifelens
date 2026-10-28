import * as Linking from 'expo-linking';

import { supabaseClient } from './supabase-client';

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const redirectTo = Linking.createURL('/auth-callback');
  const { error } = await supabaseClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}