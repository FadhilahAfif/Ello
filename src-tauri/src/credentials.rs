use crate::errors::{AppError, Result};

const TARGET: &str = "Ello/GroqApiKey";

#[cfg(target_os = "windows")]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
pub fn set(api_key: &str) -> Result<()> {
    use windows_sys::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    if api_key.trim().is_empty() {
        return Err(AppError::Settings("Groq API key cannot be empty".into()));
    }

    let mut target = wide(TARGET);
    let mut blob = api_key.as_bytes().to_vec();
    // SAFETY: the all-zero value is the documented empty CREDENTIALW state.
    let mut credential: CREDENTIALW = unsafe { std::mem::zeroed() };
    credential.Type = CRED_TYPE_GENERIC;
    credential.TargetName = target.as_mut_ptr();
    credential.CredentialBlobSize = blob.len() as u32;
    credential.CredentialBlob = blob.as_mut_ptr();
    credential.Persist = CRED_PERSIST_LOCAL_MACHINE;

    // SAFETY: all pointers reference live buffers for the duration of the call.
    if unsafe { CredWriteW(&credential, 0) } == 0 {
        return Err(AppError::Settings(format!(
            "Could not store Groq API key in Windows Credential Manager: {}",
            std::io::Error::last_os_error()
        )));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn get() -> Result<Option<String>> {
    use windows_sys::Win32::Foundation::ERROR_NOT_FOUND;
    use windows_sys::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };

    let target = wide(TARGET);
    let mut raw: *mut CREDENTIALW = std::ptr::null_mut();
    // SAFETY: target is NUL-terminated and `raw` is a valid out pointer.
    if unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) } == 0 {
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() == Some(ERROR_NOT_FOUND as i32) {
            return Ok(None);
        }
        return Err(AppError::Settings(format!(
            "Could not read Groq API key from Windows Credential Manager: {error}"
        )));
    }

    // SAFETY: CredReadW returned a valid CREDENTIALW allocation.
    let (blob, blob_size) = unsafe { ((*raw).CredentialBlob, (*raw).CredentialBlobSize as usize) };
    let bytes = if blob_size == 0 {
        Vec::new()
    } else if blob.is_null() {
        // SAFETY: allocations returned by CredReadW must be released with CredFree.
        unsafe { CredFree(raw.cast()) };
        return Err(AppError::Settings(
            "Stored Groq credential has an invalid empty data pointer".into(),
        ));
    } else {
        // SAFETY: a non-null credential blob is valid for the documented size.
        unsafe { std::slice::from_raw_parts(blob, blob_size).to_vec() }
    };
    // SAFETY: allocations returned by CredReadW must be released with CredFree.
    unsafe { CredFree(raw.cast()) };
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|_| AppError::Settings("Stored Groq API key is not valid UTF-8".into()))
}

#[cfg(target_os = "windows")]
pub fn clear() -> Result<()> {
    use windows_sys::Win32::Foundation::ERROR_NOT_FOUND;
    use windows_sys::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};

    let target = wide(TARGET);
    // SAFETY: target is a live NUL-terminated buffer.
    if unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) } == 0 {
        let error = std::io::Error::last_os_error();
        if error.raw_os_error() != Some(ERROR_NOT_FOUND as i32) {
            return Err(AppError::Settings(format!(
                "Could not clear Groq API key from Windows Credential Manager: {error}"
            )));
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn set(_api_key: &str) -> Result<()> {
    Err(AppError::Settings(
        "Groq credential storage is only supported on Windows".into(),
    ))
}

#[cfg(not(target_os = "windows"))]
pub fn get() -> Result<Option<String>> {
    Ok(None)
}

#[cfg(not(target_os = "windows"))]
pub fn clear() -> Result<()> {
    Ok(())
}
