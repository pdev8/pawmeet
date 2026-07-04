import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { usePalette } from '@/hooks/use-palette';
import type { Pet, User } from '@/lib/types';

/**
 * The signature PawMeet badge: owner avatar with their pet peeking out of the
 * bottom-right corner.
 */
export function OwnerPetBadge({
  user,
  pet,
  size = 44,
}: {
  user: User;
  pet?: Pet;
  size?: number;
}) {
  const p = usePalette();
  const petSize = Math.round(size * 0.5);
  return (
    <View style={{ width: size + petSize * 0.25, height: size + petSize * 0.25 }}>
      <Image
        source={{ uri: user.avatarUrl }}
        style={[
          styles.owner,
          { width: size, height: size, borderRadius: size / 2, borderColor: p.card },
        ]}
        accessibilityLabel={user.displayName}
        transition={150}
      />
      {pet ? (
        <Image
          source={{ uri: pet.photoUrl }}
          style={[
            styles.pet,
            {
              width: petSize,
              height: petSize,
              borderRadius: petSize / 2,
              borderColor: p.card,
            },
          ]}
          accessibilityLabel={pet.name}
          transition={150}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  owner: {
    borderWidth: 2,
  },
  pet: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});
