// Keep persisted role codes stable; these names are presentation only.
export const roleLabel = role => role === 'super_admin' ? 'Admin' : 'Staff';
export const accountName = account => account.display_name === 'Super Admin' ? 'Admin' : account.display_name;
