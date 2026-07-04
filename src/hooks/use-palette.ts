import { useColorScheme } from 'react-native';

import { Colors, type Palette } from '@/constants/theme';

export function usePalette(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}
