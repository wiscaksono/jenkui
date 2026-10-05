import { useTheme } from "../config/theme"

type ProfileDialogProps = {
  names: string[]
  active: string
  selectedIndex: number
}

export function ProfileDialog({ names, active, selectedIndex }: ProfileDialogProps) {
  const { colors } = useTheme()
  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.overlay,
        opacity: 0.85,
      }}
    >
      <box
        title=" Jenkins Profile "
        titleAlignment="center"
        border
        borderStyle="rounded"
        borderColor={colors.accent}
        style={{ flexDirection: "column", width: 40, paddingX: 2, paddingY: 1, backgroundColor: colors.surface }}
      >
        {names.map((name, index) => {
          const current = index === selectedIndex
          const isActive = name === active
          return (
            <box
              key={name}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingX: 1,
                backgroundColor: current ? colors.selection : "transparent",
              }}
            >
              <text fg={current ? colors.selectionText : colors.muted}>{name}</text>
              {isActive ? <text fg={current ? colors.selectionText : colors.success}>● active</text> : null}
            </box>
          )
        })}
        <box style={{ marginTop: 1 }}>
          <text fg={colors.faint}>enter: switch · esc: close</text>
        </box>
      </box>
    </box>
  )
}
