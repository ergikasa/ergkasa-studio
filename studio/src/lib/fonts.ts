import bold from "@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf?url";
import extraBold from "@expo-google-fonts/montserrat/800ExtraBold/Montserrat_800ExtraBold.ttf?url";
import black from "@expo-google-fonts/montserrat/900Black/Montserrat_900Black.ttf?url";

/** Registers the same Montserrat files the render worker hands to resvg, so text previews match exports. */
export async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace("Montserrat", `url(${bold})`, { weight: "700" }),
    new FontFace("Montserrat", `url(${extraBold})`, { weight: "800" }),
    new FontFace("Montserrat", `url(${black})`, { weight: "900" }),
  ];
  await Promise.all(faces.map((f) => f.load()));
  for (const f of faces) document.fonts.add(f);
}
