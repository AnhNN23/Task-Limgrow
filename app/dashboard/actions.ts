"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { Role } from "@/lib/types";

const employeeRoles: Role[] = ["developer", "tester", "business_analyst", "ui_ux", "graphic_designer"];

async function requireManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Phiên đăng nhập đã hết hạn.", supabase: null, user: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "project_manager") return { error: "Chỉ Project Manager được thực hiện thao tác này.", supabase: null, user: null };
  return { error: null, supabase, user };
}

export async function createEmployee(formData: FormData) {
  const auth = await requireManager();
  if (auth.error) return { ok: false as const, message: auth.error };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "developer") as Role;
  if (!email || !email.includes("@") || fullName.length < 2 || password.length < 8 || !employeeRoles.includes(role)) {
    return { ok: false as const, message: "Thông tin chưa hợp lệ. Mật khẩu cần ít nhất 8 ký tự." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName, role, must_change_password: true },
  });
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, user: { id: data.user.id, email, full_name: fullName, role } };
}

export async function updateEmployee(formData: FormData) {
  const auth = await requireManager();
  if (auth.error) return { ok: false as const, message: auth.error };
  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "developer") as Role;
  if (!id || fullName.length < 2 || !employeeRoles.includes(role)) return { ok: false as const, message: "Thông tin nhân sự chưa hợp lệ." };
  if (id === auth.user!.id) return { ok: false as const, message: "Không thể tự thay đổi tài khoản Project Manager đang đăng nhập." };

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin.auth.admin.getUserById(id);
  if (readError || !current.user) return { ok: false as const, message: readError?.message ?? "Không tìm thấy tài khoản." };
  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { ...current.user.user_metadata, full_name: fullName, role },
  });
  if (authError) return { ok: false as const, message: authError.message };
  const { error } = await auth.supabase!.from("profiles").update({ full_name: fullName, role }).eq("id", id);
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, profile: { id, full_name: fullName, role } };
}

export async function deleteEmployee(userId: string) {
  const auth = await requireManager();
  if (auth.error) return { ok: false as const, message: auth.error };
  if (!userId || userId === auth.user!.id) return { ok: false as const, message: "Không thể xóa tài khoản Project Manager đang đăng nhập." };

  const admin = createAdminClient();
  const dependencyChecks = await Promise.all([
    admin.from("projects").select("id", { count: "exact", head: true }).eq("created_by", userId),
    admin.from("tasks").select("id", { count: "exact", head: true }).eq("created_by", userId),
    admin.from("time_entries").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("sprints").select("id", { count: "exact", head: true }).eq("created_by", userId),
    admin.from("task_checklist_items").select("id", { count: "exact", head: true }).eq("created_by", userId),
    admin.from("task_attachments").select("id", { count: "exact", head: true }).eq("uploaded_by", userId),
  ]);
  if (dependencyChecks.some((result) => result.error)) return { ok: false as const, message: "Không thể kiểm tra dữ liệu liên quan của nhân sự." };
  if (dependencyChecks.some((result) => (result.count ?? 0) > 0)) {
    return { ok: false as const, message: "Nhân sự đã có dữ liệu công việc liên quan. Hãy chuyển dữ liệu trước khi xóa tài khoản." };
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}
