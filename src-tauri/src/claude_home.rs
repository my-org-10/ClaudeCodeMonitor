use std::env;
use std::path::PathBuf;

use crate::types::WorkspaceEntry;

pub(crate) fn resolve_workspace_claude_home(
    entry: &WorkspaceEntry,
    parent_path: Option<&str>,
) -> Option<PathBuf> {
    if entry.kind.is_worktree() {
        if let Some(parent_path) = parent_path {
            let project_home = PathBuf::from(parent_path).join(".claude");
            if project_home.is_dir() {
                return Some(project_home);
            }
        }
    }
    let project_home = PathBuf::from(&entry.path).join(".claude");
    if project_home.is_dir() {
        return Some(project_home);
    }
    None
}

pub(crate) fn resolve_default_claude_home() -> Option<PathBuf> {
    if let Ok(value) = env::var("CLAUDE_HOME") {
        if !value.trim().is_empty() {
            return Some(PathBuf::from(value.trim()));
        }
    }
    if let Ok(value) = env::var("CODEX_HOME") {
        if !value.trim().is_empty() {
            return Some(PathBuf::from(value.trim()));
        }
    }
    resolve_home_dir().map(|home| home.join(".claude"))
}

fn resolve_home_dir() -> Option<PathBuf> {
    // Try environment variables first
    if let Ok(value) = env::var("HOME") {
        if !value.trim().is_empty() {
            return Some(PathBuf::from(value));
        }
    }
    if let Ok(value) = env::var("USERPROFILE") {
        if !value.trim().is_empty() {
            return Some(PathBuf::from(value));
        }
    }
    // Fallback to platform-native home directory resolution
    // This works even in macOS app bundles launched from Finder
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;
        use std::os::raw::c_char;
        extern "C" {
            fn getpwuid(uid: u32) -> *const Passwd;
            fn getuid() -> u32;
        }
        #[repr(C)]
        struct Passwd {
            pw_name: *const c_char,
            pw_passwd: *const c_char,
            pw_uid: u32,
            pw_gid: u32,
            pw_gecos: *const c_char,
            pw_dir: *const c_char,
            pw_shell: *const c_char,
        }
        unsafe {
            let uid = getuid();
            let pwd = getpwuid(uid);
            if !pwd.is_null() {
                let home_ptr = (*pwd).pw_dir;
                if !home_ptr.is_null() {
                    if let Ok(home_str) = CStr::from_ptr(home_ptr).to_str() {
                        if !home_str.is_empty() {
                            return Some(PathBuf::from(home_str));
                        }
                    }
                }
            }
        }
    }
    None
}
