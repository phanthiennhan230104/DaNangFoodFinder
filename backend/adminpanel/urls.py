from django.urls import path
from .views import crawl_pipeline

from adminpanel.views import (
    RoleListView, RoleCreateView, RoleDetailView, RoleUpdateView, RoleDeleteView,
    UserListView, UserCreateView, UserDetailView, UserUpdateView, UserDeleteView,
    ProfileListView, ProfileCreateView, ProfileDetailView, ProfileUpdateView, ProfileDeleteView,
    AccountListView, AccountCreateView, AccountDetailView, AccountUpdateView, AccountDeleteView,
    LoginView
)
urlpatterns = [
    path("crawl/", crawl_pipeline, name="crawl_pipeline"),
    
    #ADMIN
    # Role
    path('roles/', RoleListView.as_view(), name='role-list'),
    path('roles/create/', RoleCreateView.as_view(), name='role-create'),
    path('roles/<int:pk>/', RoleDetailView.as_view(), name='role-detail'),
    path('roles/<int:pk>/update/', RoleUpdateView.as_view(), name='role-update'),
    path('roles/<int:pk>/delete/', RoleDeleteView.as_view(), name='role-delete'),

    # User
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/create/', UserCreateView.as_view(), name='user-create'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('users/<int:pk>/update/', UserUpdateView.as_view(), name='user-update'),
    path('users/<int:pk>/delete/', UserDeleteView.as_view(), name='user-delete'),

    # Profile
    path('profiles/', ProfileListView.as_view(), name='profile-list'),
    path('profiles/create/', ProfileCreateView.as_view(), name='profile-create'),
    path('profiles/<int:pk>/', ProfileDetailView.as_view(), name='profile-detail'),
    path('profiles/<int:pk>/update/', ProfileUpdateView.as_view(), name='profile-update'),
    path('profiles/<int:pk>/delete/', ProfileDeleteView.as_view(), name='profile-delete'),

    # Account
    path('accounts/', AccountListView.as_view(), name='account-list'),
    path('accounts/create/', AccountCreateView.as_view(), name='account-create'),
    path('accounts/<int:pk>/', AccountDetailView.as_view(), name='account-detail'),
    path('accounts/<int:pk>/update/', AccountUpdateView.as_view(), name='account-update'),
    path('accounts/<int:pk>/delete/', AccountDeleteView.as_view(), name='account-delete'),


    path('login/', LoginView.as_view(), name='login'),
]
