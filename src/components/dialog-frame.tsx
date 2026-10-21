import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useLayout } from "../config/layout"
import { useTheme } from "../config/theme"
import { dialogHeight, dialogWidth } from "../utils/layout"
import type { ThemeColor } from "../config/themes"

type DialogFrameProps = {
  title: string
  preferredWidth: number
  preferredHeight: number
  children: ReactNode
  footer?: ReactNode
  borderColor?: ThemeColor
  scroll?: boolean
  /** Use this when the caller owns scrolling (queue/params/profile). */
  scrollRef?: RefObject<ScrollBoxRenderable | null>
  /** Let the scrollbox receive j/k directly, e.g. the help dialog. */
  autoFocusScroll?: boolean
}

export function DialogFrame({
  title,
  preferredWidth,
  preferredHeight,
  children,
  footer,
  borderColor,
  scroll = false,
  scrollRef,
  autoFocusScroll = false,
}: DialogFrameProps) {
  const { colors } = useTheme()
  const layout = useLayout()
  const innerRef = useRef<ScrollBoxRenderable>(null)
  const ref = scrollRef ?? innerRef
  const width = dialogWidth(preferredWidth, layout.width)
  const height = dialogHeight(preferredHeight, layout.height)

  useEffect(() => {
    if (autoFocusScroll) ref.current?.focus()
  }, [autoFocusScroll, ref])

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
        title={title}
        titleAlignment="center"
        border
        borderStyle="rounded"
        borderColor={borderColor ?? colors.accent}
        style={{
          flexDirection: "column",
          width,
          height,
          paddingX: layout.narrow ? 1 : 2,
          paddingY: 1,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        {scroll ? (
          <scrollbox
            ref={ref}
            style={{ flexGrow: 1, minHeight: 0 }}
            viewportCulling
            scrollbarOptions={{
              trackOptions: { backgroundColor: colors.selectionDim, foregroundColor: colors.faint },
            }}
          >
            {children}
          </scrollbox>
        ) : (
          <box style={{ flexDirection: "column", flexGrow: 1, minHeight: 0, overflow: "hidden" }}>
            {children}
          </box>
        )}
        {footer ? <box style={{ marginTop: 1, flexShrink: 0 }}>{footer}</box> : null}
      </box>
    </box>
  )
}
