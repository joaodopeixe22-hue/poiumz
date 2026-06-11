import { MoreVertical, Play, ListPlus, ListMusic, FolderOpen, FolderPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAudioPlayer, type AudioTrack } from "@/hooks/useAudioPlayer";
import { toast } from "sonner";

type Props = {
  track: AudioTrack;
  sourcePlaylistId?: string | null;
  onOpenSourcePlaylist?: (playlistId: string) => void;
  onAddToPlaylist?: () => void;
};

/**
 * Universal track action menu — used by the library and playlist pages.
 * Lets the operator play now / play next / append to queue, regardless of
 * which playlist the track belongs to.
 */
export function TrackContextMenu({
  track,
  sourcePlaylistId,
  onOpenSourcePlaylist,
}: Props) {
  const { playTrack, addNext, addToQueue } = useAudioPlayer();
  const tagged: AudioTrack = {
    ...track,
    sourcePlaylistId: sourcePlaylistId ?? track.sourcePlaylistId ?? null,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Ações da faixa"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={() => {
            void playTrack(tagged);
          }}
        >
          <Play className="size-4 mr-2" />
          Tocar agora
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            addNext(tagged);
            toast.success(`"${track.titulo}" tocará em seguida`);
          }}
        >
          <ListPlus className="size-4 mr-2" />
          Tocar em seguida
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            addToQueue(tagged);
            toast.success(`"${track.titulo}" adicionada à fila`);
          }}
        >
          <ListMusic className="size-4 mr-2" />
          Adicionar à fila
        </DropdownMenuItem>
        {sourcePlaylistId && onOpenSourcePlaylist && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onOpenSourcePlaylist(sourcePlaylistId)}>
              <FolderOpen className="size-4 mr-2" />
              Ver playlist de origem
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
