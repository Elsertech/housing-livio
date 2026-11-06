<script type="module">
    import { requireAdmin } from "../js/admin-guard.js";

    const admin = await requireAdmin();

    if (admin) {
        constname =
            admin.user.user_metadata?.full_name ||
            admin.user.email ||
            "LIVIO Administrator";

        document.getElementById("user-name").textContent = name;
        document.getElementById("welcome-name").textContent = name;

        console.log("LIVIO Admin Dashboard:", admin.role);
    }
</script>