import { AnimatePresence, motion } from "motion/react";
import { ESTADO_LABEL, ETAPA_LABEL, type Estado, type Etapa } from "@/lib/types";
import { Field, Select } from "@/components/ui/field";

/**
 * Selector de estado y, cuando el estado es "Integrado", el selector de su etapa
 * (Ganado, En Consolidación, En Escuela de Formación, …).
 */
export function EstadoEtapaFields({
  estado,
  etapa,
  onChange,
  idPrefix = "estado",
}: {
  estado: Estado;
  etapa: Etapa | null;
  onChange: (estado: Estado, etapa: Etapa | null) => void;
  idPrefix?: string;
}) {
  return (
    <>
      <Field label="Estado" htmlFor={idPrefix}>
        <Select
          id={idPrefix}
          value={estado}
          onChange={(e) => {
            const nuevo = e.target.value as Estado;
            onChange(nuevo, nuevo === "integrado" ? (etapa ?? "ganado") : null);
          }}
        >
          {(Object.keys(ESTADO_LABEL) as Estado[]).map((k) => (
            <option key={k} value={k}>
              {ESTADO_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>
      <AnimatePresence initial={false}>
        {estado === "integrado" && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <Field label="Estatus integrado" htmlFor={`${idPrefix}-etapa`}>
              <Select
                id={`${idPrefix}-etapa`}
                value={etapa ?? "ganado"}
                onChange={(e) => onChange("integrado", e.target.value as Etapa)}
              >
                {(Object.keys(ETAPA_LABEL) as Etapa[]).map((k) => (
                  <option key={k} value={k}>
                    {ETAPA_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
