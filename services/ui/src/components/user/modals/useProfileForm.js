import { useState } from "react";
import { useAuth } from "../../../providers/AuthProvider";

export default function useProfileForm() {
  const { user, updateProfile, updatePassword } = useAuth();

  const [form, setForm] = useState({
    profileFirstName: user.first_name || "",
    profileLastName: user.last_name || "",
    profileDisplayName: user.display_name || "",
    profileEmail: user.email || "",
    profileBio: user.bio || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.id]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await updateProfile({
        first_name: form.profileFirstName,
        last_name: form.profileLastName,
        display_name: form.profileDisplayName,
        bio: form.profileBio
      });
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await updatePassword(form.currentPassword, form.newPassword);
      setSuccess("Password updated successfully.");
      setForm((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
    } catch (err) {
      setError(err.message || "Failed to update password.");
    }
  };

  return { form, error, success, handleChange, handleSubmit, handlePasswordSubmit };
}
