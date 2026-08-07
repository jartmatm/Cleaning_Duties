import { useAppTheme } from "@/hooks/use-app-theme";
import { selectPhoto, takePhoto, type LocalPhoto } from "@/services/photo-service";
import { ImagePlus, X } from "lucide-react-native";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export function PhotoPicker({ label, photos, onChange, disabled = false }: {
  label: string;
  photos: LocalPhoto[];
  onChange: (photos: LocalPhoto[]) => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();

  function addPhoto(source: "camera" | "library") {
    const action = source === "camera" ? takePhoto() : selectPhoto();
    void action.then((photo) => {
      if (photo) onChange([...photos, photo]);
    }).catch((error) => Alert.alert("Photo unavailable", error instanceof Error ? error.message : "The photo could not be opened."));
  }

  function openSourceMenu() {
    Alert.alert("Add photo", "Choose a source", [
      { text: "Take photo", onPress: () => addPhoto("camera") },
      { text: "Photo library", onPress: () => addPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.ink }]}>{label}</Text>
        <Text style={[styles.count, { color: theme.muted }]}>{photos.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable disabled={disabled} onPress={openSourceMenu} style={[styles.add, { borderColor: theme.border, backgroundColor: theme.surface, opacity: disabled ? 0.45 : 1 }]}>
          <ImagePlus color={theme.primary} size={22} />
          <Text style={[styles.addText, { color: theme.primary }]}>Add</Text>
        </Pressable>
        {photos.map((photo, index) => (
          <View key={`${photo.uri}-${index}`} style={styles.preview}>
            <Image source={{ uri: photo.uri }} style={styles.image} />
            <Pressable accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => onChange(photos.filter((_, itemIndex) => itemIndex !== index))} style={styles.remove}>
              <X color="#ffffff" size={14} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 9 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 13, fontWeight: "700" },
  count: { fontSize: 12, fontWeight: "700" },
  row: { gap: 10 },
  add: { width: 92, height: 92, borderRadius: 7, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 5 },
  addText: { fontSize: 12, fontWeight: "700" },
  preview: { width: 92, height: 92 },
  image: { width: "100%", height: "100%", borderRadius: 7, backgroundColor: "#f2f4f7" },
  remove: { position: "absolute", top: 5, right: 5, width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17, 24, 39, 0.82)" },
});
