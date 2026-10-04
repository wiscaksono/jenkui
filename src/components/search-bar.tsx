import { forwardRef, useEffect, useRef } from "react"
import type { InputRenderable } from "@opentui/core"
import { colors } from "../config/theme"

type SearchBarProps = {
  placeholder: string
  value: string
  focused: boolean
  onValueChange: (value: string) => void
}

export const SearchBar = forwardRef<InputRenderable, SearchBarProps>(function SearchBar(
  { placeholder, value, focused, onValueChange },
  ref,
) {
  const innerRef = useRef<InputRenderable>(null)

  const setRef = (node: InputRenderable | null) => {
    innerRef.current = node
    if (typeof ref === "function") ref(node)
    else if (ref) ref.current = node
  }

  useEffect(() => {
    if (focused) innerRef.current?.focus()
    else innerRef.current?.blur()
  }, [focused])

  return (
    <box
      style={{
        border: ["bottom", "top"],
        borderColor: focused ? colors.accent : colors.faint,
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 1,
        gap: 1,
      }}
    >
      <text fg={colors.muted}>{"\u{f002}"}</text>
      <input ref={setRef} value={value} placeholder={placeholder} onInput={onValueChange} style={{ flexGrow: 1 }} />
    </box>
  )
})
