// ============================================================================
// VEBOSSO EMS — User Avatar
// Drop-in for Paper's Avatar.Text: shows the person's profile photo when they
// have one, their initials otherwise.
// ============================================================================

import { Image } from 'expo-image';
import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar } from 'react-native-paper';

type AvatarTextProps = ComponentProps<typeof Avatar.Text>;

interface UserAvatarProps extends AvatarTextProps {
  /** profiles.avatar_url */
  uri?: string | null;
}

export function UserAvatar({ uri, size = 40, style, ...rest }: UserAvatarProps) {
  if (!uri) return <Avatar.Text size={size} style={style} {...rest} />;

  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[style, round, styles.clip]}>
      <Image
        source={{ uri }}
        style={round}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
