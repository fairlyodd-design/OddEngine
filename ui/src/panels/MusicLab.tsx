import Entertainment from "./Entertainment";

type MusicLabProps = { onNavigate?: (panel: string) => void };

export default function MusicLab(_props: MusicLabProps) {
  return <Entertainment />;
}
