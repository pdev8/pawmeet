import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Platform, View } from 'react-native';

export function Icon({
  sf,
  size = 18,
  color,
}: {
  sf: string;
  size?: number;
  color?: string;
}) {
  if (Platform.OS !== 'ios') {
    return <View style={{ width: size, height: size }} />;
  }
  return (
    <SymbolView
      name={sf as SFSymbol}
      size={size}
      tintColor={color}
      resizeMode="scaleAspectFit"
    />
  );
}
