import { forwardRef, type ComponentRef } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { radius, type } from "@crew/design-tokens";
import { useTheme } from "@/theme";
import { Text } from "@/ui/Text";

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
}

/** Label, input and one line of help or error: never several texts saying the same thing. */
export const Field = forwardRef<ComponentRef<typeof TextInput>, Props>(function Field({ label, hint, error, style, ...input }, ref) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={theme.textMuted}
        {...input}
        style={[
          styles.input,
          type.body,
          { color: theme.text, backgroundColor: theme.inputBg, borderColor: error ? theme.danger : theme.inputBorder },
          style,
        ]}
      />
      {error ? (
        <Text variant="small" color={theme.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small">{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: { minHeight: 52, borderRadius: radius.input, borderWidth: 1.5, paddingHorizontal: 14 },
});
