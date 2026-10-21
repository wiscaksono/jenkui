import { useEffect, useRef } from "react"
import { TextAttributes, type InputRenderable } from "@opentui/core"
import { useTheme } from "../config/theme"
import type { ParamField } from "../types"

type ParamsDialogProps = {
  projectName: string
  fields: ParamField[]
  index: number
  editing: boolean
  onChange: (value: string) => void
}

function typeLabel(type: string): string {
  if (type.includes("Boolean")) return "bool"
  if (type.includes("Choice")) return "choice"
  if (type.includes("Password")) return "secret"
  if (type.includes("Text")) return "text"
  return "string"
}

const isSecretType = (type: string): boolean => type.includes("Password")

export function ParamsDialog({ projectName, fields, index, editing, onChange }: ParamsDialogProps) {
  const { colors } = useTheme()
  const inputRef = useRef<InputRenderable>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
    else inputRef.current?.blur()
  }, [editing])

  const selected = fields[index]

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
        title={` Build ${projectName} `}
        titleAlignment="center"
        border
        borderStyle="rounded"
        borderColor={colors.accent}
        style={{ flexDirection: "column", width: 72, paddingX: 2, paddingY: 1, backgroundColor: colors.surface }}
      >
        {fields.map((field, fieldIndex) => {
          const current = fieldIndex === index
          const isEditing = current && editing
          const secret = isSecretType(field.type)
          return (
            <box
              key={field.name}
              style={{
                flexDirection: "row",
                gap: 1,
                paddingX: 1,
                backgroundColor: current ? colors.selection : "transparent",
              }}
            >
              <text fg={current ? colors.selectionText : colors.muted} width={24} wrapMode="none">
                {field.name}
              </text>
              <text fg={current ? colors.selectionText : colors.faint} width={7} wrapMode="none">
                {typeLabel(field.type)}
              </text>
              {isEditing && secret ? (
                // OpenTUI inputs have no password mode. Match the input color to
                // the selected row so the value is not visibly rendered, and
                // show a masked count for feedback.
                <box style={{ flexDirection: "row", flexGrow: 1, gap: 1 }}>
                  <text fg={current ? colors.selectionText : colors.foreground} wrapMode="none">
                    {"•".repeat(Math.min(field.value.length, 24)) +
                      (field.value.length > 24 ? "…" : "") || "(empty)"}
                  </text>
                  <input
                    ref={inputRef}
                    value={field.value}
                    onInput={onChange}
                    style={{ flexGrow: 1 }}
                    attributes={TextAttributes.HIDDEN}
                    backgroundColor={colors.selection}
                    focusedBackgroundColor={colors.selection}
                    textColor={colors.selection}
                    focusedTextColor={colors.selection}
                    cursorColor={colors.selection}
                    selectionBg={colors.selection}
                    selectionFg={colors.selection}
                  />
                </box>
              ) : isEditing ? (
                <input
                  ref={inputRef}
                  value={field.value}
                  onInput={onChange}
                  style={{ flexGrow: 1 }}
                  textColor={colors.foreground}
                  focusedTextColor={colors.foreground}
                  cursorColor={colors.accent}
                  selectionBg={colors.selection}
                  selectionFg={colors.selectionText}
                />
              ) : (
                <text fg={current ? colors.selectionText : colors.foreground} wrapMode="none">
                  {secret ? (field.value ? "••••" : "(empty)") : field.value || "(empty)"}
                </text>
              )}
            </box>
          )
        })}
        {selected?.choices && selected.choices.length > 0 ? (
          <box style={{ marginTop: 1, paddingX: 1 }}>
            <text fg={colors.faint} wrapMode="none">
              {`choices: ${selected.choices.join(" | ")}`}
            </text>
          </box>
        ) : null}
        {selected?.type.includes("Boolean") ? (
          <box style={{ marginTop: 1, paddingX: 1 }}>
            <text fg={colors.faint} wrapMode="none">
              choices: true | false
            </text>
          </box>
        ) : null}
        {selected?.description ? (
          <box style={{ paddingX: 1 }}>
            <text fg={colors.faint} wrapMode="none">
              {selected.description}
            </text>
          </box>
        ) : null}
        <box style={{ marginTop: 1, paddingX: 1 }}>
          <text fg={editing ? colors.running : colors.faint}>
            {editing ? "enter: save · esc: cancel edit" : "j/k: move · enter: edit · b: build · esc: close"}
          </text>
        </box>
      </box>
    </box>
  )
}
