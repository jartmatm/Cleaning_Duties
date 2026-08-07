import { useNetwork } from "@/providers/network-provider";
import { useAppTheme } from "@/hooks/use-app-theme";
import { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export function AppScreen({ children, scroll = true, safeEdges = ["top", "left", "right"], contentContainerStyle, ...scrollProps }: {
  children: ReactNode;
  scroll?: boolean;
  safeEdges?: Edge[];
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
} & Omit<ScrollViewProps, "contentContainerStyle">) {
  const theme = useAppTheme();
  const { isOnline } = useNetwork();
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : <View style={[styles.content, styles.fill]}>{children}</View>;

  return (
    <SafeAreaView edges={safeEdges} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {!isOnline ? <View style={styles.offline}><Text style={styles.offlineText}>Offline. Changes are disabled until the connection returns.</Text></View> : null}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  offline: { backgroundColor: "#fffaeb", borderBottomColor: "#fedf89", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 8 },
  offlineText: { color: "#93370d", fontSize: 12, fontWeight: "600", textAlign: "center" },
});
