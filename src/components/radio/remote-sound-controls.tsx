import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlaybackState } from "@/hooks/use-playback";
import { SOUND_PROFILES, clampVolume, getProfile } from "@/lib/sound-profiles";

const VOLUME_EVENT = "radio:setVolume";
/** Enquanto o operador mexe, o valor local manda; depois volta a seguir o banco. */
const LOCAL_HOLD_MS = 1500;
const SEND_DELAY_MS = 250;

type Result = Promise<{ error: string | null }>;

/**
 * Som remoto: volume e perfil de ambiente da rádio, gravados em playback_state.
 * Valem para todos os aparelhos que estão ouvindo — é assim que o operador
 * ajusta, pelo celular, o som do computador da loja.
 */
export function RemoteSoundControls({
  playback,
  disabled = false,
  onVolume,
  onProfile,
  className = "",
}: {
  playback: PlaybackState | null;
  disabled?: boolean;
  onVolume: (volume: number) => Result;
  onProfile: (profileId: string) => Result;
  className?: string;
}) {
  const remote = clampVolume(playback?.volume);
  const [value, setValue] = useState(remote);
  const holdUntil = useRef(0);
  const sendTimer = useRef<number | null>(null);
  const lastAudible = useRef(remote > 0 ? remote : 0.8);

  // Segue o volume vindo do banco, exceto enquanto o operador está mexendo aqui.
  useEffect(() => {
    if (Date.now() >= holdUntil.current) setValue(remote);
    if (remote > 0) lastAudible.current = remote;
  }, [remote]);

  useEffect(
    () => () => {
      if (sendTimer.current !== null) window.clearTimeout(sendTimer.current);
    },
    [],
  );

  const send = (volume: number) => {
    if (sendTimer.current !== null) {
      window.clearTimeout(sendTimer.current);
      sendTimer.current = null;
    }
    void onVolume(volume).then(({ error }) => {
      if (error) toast.error(error);
    });
  };

  const change = (next: number, commitNow = false) => {
    const volume = clampVolume(next);
    setValue(volume);
    if (volume > 0) lastAudible.current = volume;
    holdUntil.current = Date.now() + LOCAL_HOLD_MS;
    // Resposta imediata no player desta página, se houver.
    window.dispatchEvent(new CustomEvent(VOLUME_EVENT, { detail: { volume } }));
    if (sendTimer.current !== null) window.clearTimeout(sendTimer.current);
    if (commitNow) send(volume);
    else sendTimer.current = window.setTimeout(() => send(volume), SEND_DELAY_MS);
  };

  const toggleMute = () => change(value > 0 ? 0 : lastAudible.current || 0.8, true);

  const pickProfile = async (id: string) => {
    const { error } = await onProfile(id);
    if (error) toast.error(error);
  };

  const percent = Math.round(value * 100);
  const profile = getProfile(playback?.sound_profile);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-primary" />
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Som da loja
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMute}
          disabled={disabled}
          className="size-9 shrink-0 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:pointer-events-none"
          aria-label={value === 0 ? "Devolver o som da rádio" : "Silenciar a rádio"}
        >
          {value === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <Slider
          value={[percent]}
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          onValueChange={(v) => change((v[0] ?? 0) / 100)}
          onValueCommit={(v) => change((v[0] ?? 0) / 100, true)}
          className="flex-1"
          aria-label="Volume da rádio"
        />
        <span className="w-10 shrink-0 text-right text-sm font-mono tabular-nums text-muted-foreground">
          {percent}%
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-sm text-muted-foreground sm:w-36 shrink-0">Perfil de ambiente</span>
        <Select value={profile.id} onValueChange={pickProfile} disabled={disabled}>
          <SelectTrigger className="sm:flex-1" aria-label="Perfil de ambiente da rádio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOUND_PROFILES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {profile.descricao} Volume e perfil valem para todos os aparelhos que estão ouvindo a rádio.
      </p>
    </div>
  );
}
