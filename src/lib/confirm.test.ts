import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Alert: { alert: vi.fn() } }));

import { Alert } from 'react-native';
import { confirmDestructive } from './confirm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const alert = Alert.alert as any;

type Btn = { text: string; style?: string; onPress?: () => void };

beforeEach(() => vi.clearAllMocks());

describe('confirmDestructive', () => {
  it('shows a Cancel + destructive button with the title/message', () => {
    confirmDestructive({ title: 'Remove Rex?', message: 'This deletes your pet.', onConfirm: () => {} });
    const [title, message, buttons] = alert.mock.calls[0] as [string, string, Btn[]];
    expect(title).toBe('Remove Rex?');
    expect(message).toBe('This deletes your pet.');
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].style).toBe('destructive');
  });

  it('uses a custom confirm label', () => {
    confirmDestructive({ title: 'Block user?', confirmLabel: 'Block', onConfirm: () => {} });
    const buttons = alert.mock.calls[0][2] as Btn[];
    expect(buttons[1].text).toBe('Block');
  });

  it('wires onConfirm to the destructive button', () => {
    const onConfirm = vi.fn();
    confirmDestructive({ title: 'x', onConfirm });
    const buttons = alert.mock.calls[0][2] as Btn[];
    buttons[1].onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('wires onCancel to the Cancel button (and tolerates it being omitted)', () => {
    const onCancel = vi.fn();
    confirmDestructive({ title: 'x', onConfirm: () => {}, onCancel });
    const buttons = alert.mock.calls[0][2] as Btn[];
    buttons[0].onPress?.();
    expect(onCancel).toHaveBeenCalledTimes(1);

    confirmDestructive({ title: 'y', onConfirm: () => {} });
    const buttons2 = alert.mock.calls[1][2] as Btn[];
    expect(() => buttons2[0].onPress?.()).not.toThrow();
  });
});
