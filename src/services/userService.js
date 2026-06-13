import { supabase } from "../supabase/supabaseConfig";
import { createClient } from "@supabase/supabase-js";

// Fetch all profiles from sipakdesa_users
export async function getAllUsers() {
  const { data, error } = await supabase
    .from("sipakdesa_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Gagal mengambil data pengguna: ${error.message}`);
  }

  // Map database fields to what the frontend expects
  return data.map((u) => ({
    id: u.id,
    uid: u.id, // for compatibility
    name: u.fullname ?? "",
    email: u.email,
    role: u.role,
    status: u.active ? "active" : "suspended",
    suspended: !u.active, // for compatibility
    createdAt: u.created_at,
  }));
}

// Register a new user without interrupting the currently logged-in user session
export async function registerUser({ name, email, password, role }) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Create an isolated client that does not persist session
  const secondaryClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // 1. Sign up the user in Supabase Auth
  const { data, error: signUpError } = await secondaryClient.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    throw signUpError;
  }

  const newUser = data.user;
  if (!newUser) {
    throw new Error("Pendaftaran gagal: Pengguna tidak dikembalikan.");
  }

  // 2. Insert the user profile manually under sipakdesa_users
  const profileData = {
    id: newUser.id,
    fullname: name,
    email,
    role,
    active: true,
  };

  const { error: profileError } = await supabase
    .from("sipakdesa_users")
    .insert([profileData]);

  if (profileError) {
    // Attempt cleanup if profile creation fails, though signUp cannot be easily undone from client-side anon key
    throw new Error(`Pendaftaran auth berhasil, tetapi gagal membuat profil: ${profileError.message}`);
  }

  return { uid: newUser.id, id: newUser.id, ...profileData };
}

// Update user profile (name, role)
export async function updateUser(uid, { name, role }) {
  const updateData = {};
  if (name !== undefined) {
    updateData.fullname = name;
  }

  if (role) {
    updateData.role = role;
  }

  const { error } = await supabase
    .from("sipakdesa_users")
    .update(updateData)
    .eq("id", uid);

  if (error) {
    throw new Error(`Gagal memperbarui profil pengguna: ${error.message}`);
  }

  return { uid };
}

// Toggle suspend/unsuspend status
export async function toggleSuspendUser(uid, currentlySuspended) {
  const { error } = await supabase
    .from("sipakdesa_users")
    .update({
      active: !!currentlySuspended,
    })
    .eq("id", uid);

  if (error) {
    throw new Error(`Gagal memperbarui status penangguhan pengguna: ${error.message}`);
  }

  return { uid, status: currentlySuspended ? "active" : "suspended" };
}

// Delete user profile
export async function deleteUser(uid) {
  const { error } = await supabase
    .from("sipakdesa_users")
    .delete()
    .eq("id", uid);

  if (error) {
    throw new Error(`Gagal menghapus profil pengguna dari database: ${error.message}`);
  }

  return { success: true };
}
