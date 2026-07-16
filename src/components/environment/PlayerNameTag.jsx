import { Billboard, Image, Text } from "@react-three/drei";

const NAME_TAG_FONT = "/fonts/Ethnocentric-Regular.otf";

const clampName = (name) => String(name || "").slice(0, 18);

export const lobbyTagProps = {
  fontSize: 0.46,
  position: [0, 3.07, 0],
  anchorX: "center",
  anchorY: "middle",
  editable: true,
  font: NAME_TAG_FONT,
};

export const gameTagProps = {
  fontSize: 0.34,
  position: [0, 2.45, 0],
  anchorX: "center",
  anchorY: "middle",
  hideSelf: true,
  font: NAME_TAG_FONT,
};

export function PlayerNameTag({
  name,
  isMe = false,
  hideSelf = false,
  onEdit,
  position = [0, 0, 0],
  fontSize = 0.34,
  anchorX = "center",
  anchorY = "middle",
  editable = false,
  showEditIcon = true,
  font = NAME_TAG_FONT,
}) {
  if (hideSelf && isMe) return null;

  const displayName = clampName(name);

  return (
    <Billboard position={position}>
      <Text
        font={font}
        fontSize={fontSize}
        anchorX={anchorX}
        anchorY={anchorY}
        textAlign="center"
        maxWidth={4.5}
        outlineWidth={fontSize * 0.08}
        outlineColor="#000000"
        outlineOpacity={0.85}
      >
        {displayName}
        <meshBasicMaterial color="white" toneMapped={false} />
      </Text>
      {editable && isMe && onEdit && showEditIcon && (
        <Image
          onClick={onEdit}
          position={[fontSize * 0.9, 0, 0]}
          scale={fontSize * 0.7}
          url="images/edit.png"
          transparent
        />
      )}
    </Billboard>
  );
}
