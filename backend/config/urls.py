"""
URL Configuration for NeuralNomad API
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_urlpatterns = [
    # API documentation
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # App URLs
    path('accounts/', include('apps.accounts.urls')),
    path('bookings/', include('apps.bookings.urls')),
    path('attractions/', include('apps.attractions.urls')),
    path('visa/', include('apps.visa.urls')),
    path('forex/', include('apps.forex.urls')),
    path('travelpass/', include('apps.travelpass.urls')),
    path('wallet/', include('apps.wallet.urls')),
    path('notifications/', include('apps.notifications.urls')),
    path('homepage/', include('apps.homepage.urls')),
    path('planner/', include('apps.planner.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(api_urlpatterns)),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Health check endpoint
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(['GET'])
def health_check(request):
    return JsonResponse({'status': 'healthy'})


urlpatterns.append(path('health/', health_check, name='health_check'))
