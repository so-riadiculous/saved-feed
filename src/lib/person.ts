import type { Person } from "./auth";

export function otherPerson(person: Person): Person {
  return person === "ria" ? "dad" : "ria";
}
