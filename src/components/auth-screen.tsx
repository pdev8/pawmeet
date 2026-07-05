import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PawkLogo } from '@/components/logo';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup';

export function AuthScreen() {
  const p = usePalette();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const mail = email.trim();
    if (!mail || !password) {
      Alert.alert('Enter your email and password to continue.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { data: { display_name: name.trim() || mail.split('@')[0] } },
        });
        if (error) throw error;
        // With email confirmation on, signUp returns no session until confirmed.
        if (!data.session) {
          Alert.alert('Check your email', 'Confirm your address, then sign in.');
          setMode('signin');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) throw error;
      }
      // On success, the session lands via onAuthStateChange and the app renders.
    } catch (e) {
      Alert.alert('Couldn’t sign in', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: p.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <View style={styles.brand}>
            <PawkLogo size={64} />
            <Text style={[styles.title, { color: p.text }]}>Pawk</Text>
            <Text style={[styles.tagline, { color: p.textSecondary }]}>
              {isSignup ? 'Create your account' : 'Welcome back'}
            </Text>
          </View>

          {isSignup ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={p.textSecondary}
              autoCapitalize="words"
              style={[styles.input, { color: p.text, backgroundColor: p.card, borderColor: p.separator }]}
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={p.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={[styles.input, { color: p.text, backgroundColor: p.card, borderColor: p.separator }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={p.textSecondary}
            secureTextEntry
            textContentType={isSignup ? 'newPassword' : 'password'}
            onSubmitEditing={submit}
            style={[styles.input, { color: p.text, backgroundColor: p.card, borderColor: p.separator }]}
          />

          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: p.accent, opacity: busy ? 0.7 : 1 }]}>
            {busy ? (
              <ActivityIndicator color={p.onAccent} />
            ) : (
              <Text style={[styles.ctaText, { color: p.onAccent }]}>
                {isSignup ? 'Sign up' : 'Sign in'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setMode(isSignup ? 'signin' : 'signup')}
            hitSlop={8}
            style={styles.toggle}>
            <Text style={[styles.toggleText, { color: p.textSecondary }]}>
              {isSignup ? 'Already have an account? ' : 'New here? '}
              <Text style={{ color: p.accent, fontWeight: '700' }}>
                {isSignup ? 'Sign in' : 'Create one'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  brand: { alignItems: 'center', gap: 4, marginBottom: Spacing.four },
  title: { fontSize: 34, fontWeight: '800', fontFamily: Fonts?.rounded },
  tagline: { fontSize: 15, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    padding: 14,
    fontSize: 16,
  },
  cta: {
    marginTop: Spacing.two,
    borderRadius: Radii.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '800', fontFamily: Fonts?.rounded },
  toggle: { alignItems: 'center', paddingVertical: Spacing.two },
  toggleText: { fontSize: 14 },
});
