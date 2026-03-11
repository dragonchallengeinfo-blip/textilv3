"""
Test Setup Wizard Backend Endpoints
- POST /api/users/complete-setup - Marks wizard as completed
- POST /api/users/reset-setup - Resets wizard to show again
- GET /api/users/me - Returns user with setup_completed field
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestSetupWizardEndpoints:
    """Tests for the Setup Wizard feature endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@textil.pt", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def authenticated_session(self, auth_token):
        """Session with auth header"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_01_login_returns_setup_completed_field(self):
        """Verify login response includes setup_completed field"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@textil.pt", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user" in data, "No user in login response"
        assert "setup_completed" in data["user"], "setup_completed field missing in user response"
        assert isinstance(data["user"]["setup_completed"], bool), "setup_completed should be boolean"
    
    def test_02_get_me_returns_setup_completed(self, authenticated_session):
        """GET /api/users/me should return setup_completed field"""
        response = authenticated_session.get(f"{BASE_URL}/api/users/me")
        assert response.status_code == 200
        data = response.json()
        assert "setup_completed" in data, "setup_completed missing in /users/me response"
        assert isinstance(data["setup_completed"], bool), "setup_completed should be boolean"
    
    def test_03_reset_setup_works(self, authenticated_session):
        """POST /api/users/reset-setup should reset wizard"""
        response = authenticated_session.post(f"{BASE_URL}/api/users/reset-setup")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data, "No message in reset response"
        
        # Verify setup_completed is now false
        me_response = authenticated_session.get(f"{BASE_URL}/api/users/me")
        assert me_response.status_code == 200
        assert me_response.json()["setup_completed"] == False, "setup_completed should be False after reset"
    
    def test_04_complete_setup_works(self, authenticated_session):
        """POST /api/users/complete-setup should mark wizard as completed"""
        response = authenticated_session.post(f"{BASE_URL}/api/users/complete-setup")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data, "No message in complete response"
        
        # Verify setup_completed is now true
        me_response = authenticated_session.get(f"{BASE_URL}/api/users/me")
        assert me_response.status_code == 200
        assert me_response.json()["setup_completed"] == True, "setup_completed should be True after complete"
    
    def test_05_unauthorized_access_denied(self):
        """Endpoints should require authentication"""
        # Test complete-setup without auth
        response = requests.post(f"{BASE_URL}/api/users/complete-setup")
        assert response.status_code in [401, 403], "Should require authentication"
        
        # Test reset-setup without auth
        response = requests.post(f"{BASE_URL}/api/users/reset-setup")
        assert response.status_code in [401, 403], "Should require authentication"
    
    def test_06_reset_then_check_state(self, authenticated_session):
        """Test full workflow: reset then verify state"""
        # First reset
        reset_response = authenticated_session.post(f"{BASE_URL}/api/users/reset-setup")
        assert reset_response.status_code == 200
        
        # Check state is False
        me_response = authenticated_session.get(f"{BASE_URL}/api/users/me")
        assert me_response.status_code == 200
        assert me_response.json()["setup_completed"] == False
        
        # Complete setup
        complete_response = authenticated_session.post(f"{BASE_URL}/api/users/complete-setup")
        assert complete_response.status_code == 200
        
        # Check state is True
        me_response = authenticated_session.get(f"{BASE_URL}/api/users/me")
        assert me_response.status_code == 200
        assert me_response.json()["setup_completed"] == True


class TestDashboardEndpoint:
    """Test Dashboard endpoint that provides wizard context"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@textil.pt", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def authenticated_session(self, auth_token):
        """Session with auth header"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_dashboard_loads(self, authenticated_session):
        """Dashboard endpoint should return data"""
        response = authenticated_session.get(f"{BASE_URL}/api/dashboard/")
        assert response.status_code == 200
        data = response.json()
        # Dashboard should return project statistics
        assert "active_projects" in data or isinstance(data, dict)


class TestWizardRelatedEndpoints:
    """Test endpoints used by the Setup Wizard"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@textil.pt", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def authenticated_session(self, auth_token):
        """Session with auth header"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_stages_endpoint(self, authenticated_session):
        """GET /api/stages/ should return stages list"""
        response = authenticated_session.get(f"{BASE_URL}/api/stages/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Stages should be a list"
    
    def test_checkpoints_endpoint(self, authenticated_session):
        """GET /api/checkpoints/ should return checkpoints list"""
        response = authenticated_session.get(f"{BASE_URL}/api/checkpoints/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Checkpoints should be a list"
    
    def test_brands_endpoint(self, authenticated_session):
        """GET /api/brands/ should return brands list"""
        response = authenticated_session.get(f"{BASE_URL}/api/brands/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Brands should be a list"
    
    def test_partners_endpoint(self, authenticated_session):
        """GET /api/partners/ should return partners list"""
        response = authenticated_session.get(f"{BASE_URL}/api/partners/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Partners should be a list"
