import { Billboard, Image, Text } from "@react-three/drei";

const clampName = (name) => String(name || "").slice(0, 100);

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
}) {
  if (hideSelf && isMe) return null;

  const displayName = clampName(name);

  return (
    <Billboard position={position}>
      <Text fontSize={fontSize} anchorX={anchorX} anchorY={anchorY} textAlign="center" maxWidth={4.5}>
        {displayName}
        <meshBasicMaterial color="white" />
      </Text>
      <Text
        fontSize={fontSize}
        anchorX={anchorX}
        anchorY={anchorY}
        textAlign="center"
        maxWidth={4.5}
        position={[0.02, -0.02, -0.01]}
      >
        {displayName}
        <meshBasicMaterial color="black" transparent opacity={0.82} />
      </Text>
      {editable && isMe && onEdit && (
        <>
          <Image onClick={onEdit} position={[0.2, 0, 0]} scale={0.3} url="images/edit.png" transparent />
          <Image position={[0.22, -0.02, -0.01]} scale={0.3} url="images/edit.png" transparent color="black" />
        </>
      )}
    </Billboard>
  );
}
