from django.shortcuts import redirect

try:
    from azure_auth.views import azure_auth_callback as _library_callback
except Exception:
    _library_callback = None


def azure_auth_callback(request):
    if request.GET.get("error"):
        return redirect("/auth/")
    if _library_callback:
        return _library_callback(request)
    return redirect("/auth/")
