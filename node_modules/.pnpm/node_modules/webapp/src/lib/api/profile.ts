import { api } from "./index";
import type { Profile } from "../types";

export function getProfile(): Promise<Profile> {
  return api<Profile>("/profile");
}

export function updateProfile(body: Partial<Pick<Profile, "phone" | "city" | "place" | "specialReference">>): Promise<Profile> {
  return api<Profile>("/profile", { method: "PUT", body: JSON.stringify(body) });
}