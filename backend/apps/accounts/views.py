"""
Accounts app views
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

from .models import UserPreference, UploadedDocument, ActivityLog
from .serializers import (
    UserSerializer, UserDetailSerializer, LoginSerializer,
    RegisterSerializer, UserPreferenceSerializer,
    UploadedDocumentSerializer, ActivityLogSerializer
)
from .google_auth import verify_google_token

User = get_user_model()


class AuthViewSet(viewsets.ViewSet):
    """Authentication endpoints"""

    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def login(self, request):
        """Login endpoint"""
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        })

    @action(detail=False, methods=['post'])
    def register(self, request):
        """Register endpoint"""
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def google(self, request):
        """Google OAuth Login/Register"""
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Hardcoding the client ID as specified
        client_id = "504846204351-i9faae4vu66s09f19e2h3sgtsas73mi6.apps.googleusercontent.com"
        idinfo = verify_google_token(token, client_id)
        
        if not idinfo:
            return Response({'error': 'Invalid Google token'}, status=status.HTTP_400_BAD_REQUEST)
        
        email = idinfo.get('email')
        name = idinfo.get('name', '')
        
        if not email:
            return Response({'error': 'No email provided by Google'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user exists
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'name': name, 'is_email_verified': True, 'phone': ''}
        )
        
        # Issue tokens
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        })

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        """Logout endpoint"""
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_200_OK)
        except Exception:
            return Response(status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    """User viewset for CRUD operations"""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UserDetailSerializer
        return UserSerializer

    @action(detail=False, methods=['get'])
    def profile(self, request):
        """Get current user profile"""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['put', 'patch'])
    def update_profile(self, request):
        """Update current user profile"""
        old_phone = request.user.phone
        
        serializer = UserDetailSerializer(
            request.user,
            data=request.data,
            partial=request.method in ['PATCH', 'PUT']
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Handle Avatar upload if provided
        if 'avatar' in request.FILES:
            user.avatar = request.FILES['avatar']
            user.save()
            
        # Reset phone verified if phone changed
        if 'phone' in request.data and request.data['phone'] != old_phone:
            user.is_phone_verified = False
            user.save()
            
        return Response(UserDetailSerializer(user).data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change password"""
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not user.check_password(old_password):
            return Response(
                {'error': 'Old password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()
        return Response({'status': 'password changed'})


class UserPreferenceViewSet(viewsets.ModelViewSet):
    """User preference viewset"""

    queryset = UserPreference.objects.all()
    serializer_class = UserPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    @action(detail=False, methods=['get', 'put', 'patch'])
    def my_preferences(self, request):
        """Get or update current user preferences"""
        try:
            preferences = request.user.preferences
        except UserPreference.DoesNotExist:
            preferences = UserPreference.objects.create(user=request.user)

        if request.method == 'GET':
            serializer = UserPreferenceSerializer(preferences)
            return Response(serializer.data)

        serializer = UserPreferenceSerializer(
            preferences,
            data=request.data,
            partial=request.method == 'PATCH'
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UploadedDocumentViewSet(viewsets.ModelViewSet):
    """Uploaded document viewset"""

    queryset = UploadedDocument.objects.all()
    serializer_class = UploadedDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Activity log viewset (read-only)"""

    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)
