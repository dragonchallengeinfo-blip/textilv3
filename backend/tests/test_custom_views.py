"""
Test suite for Custom Views (Listagens Personalizadas) API endpoints
Tests: CRUD operations, inline editing, and audit trail functionality
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
LOGIN_CREDENTIALS = {
    "email": "admin@textil.pt",
    "password": "admin123"
}


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for all tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=LOGIN_CREDENTIALS
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestCustomViewsAPI:
    """Test Custom Views CRUD operations"""
    
    created_view_id = None  # Store for cleanup
    
    def test_get_available_fields(self, api_client):
        """Test GET /api/custom-views/fields - Get available fields"""
        response = api_client.get(f"{BASE_URL}/api/custom-views/fields")
        assert response.status_code == 200
        
        data = response.json()
        assert "fields" in data
        assert "editable_fields" in data
        assert "project" in data["fields"]
        assert len(data["fields"]["project"]) > 0
        
        # Verify editable fields list
        editable = data["editable_fields"]
        assert "modelo" in editable
        assert "quantidade" in editable
        assert "status_projeto" in editable
        print("✓ Available fields retrieved successfully")
    
    def test_get_custom_views_list(self, api_client):
        """Test GET /api/custom-views/ - List all custom views"""
        response = api_client.get(f"{BASE_URL}/api/custom-views/")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify existing test view exists
        view_names = [v["nome"] for v in data]
        assert "Vista de Teste" in view_names, "Expected 'Vista de Teste' to exist"
        print(f"✓ Found {len(data)} custom views")
    
    def test_create_custom_view(self, api_client):
        """Test POST /api/custom-views/ - Create new custom view"""
        unique_name = f"TEST_Vista_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "nome": unique_name,
            "descricao": "Vista criada por pytest",
            "entidade": "project",
            "columns": [
                {"field": "of_numero", "label": "Nº OF", "editable": False, "type": "text"},
                {"field": "modelo", "label": "Modelo", "editable": True, "type": "text"},
                {"field": "quantidade", "label": "Quantidade", "editable": True, "type": "number"}
            ],
            "is_public": False
        }
        
        response = api_client.post(f"{BASE_URL}/api/custom-views/", json=payload)
        assert response.status_code == 201
        
        data = response.json()
        assert data["nome"] == unique_name
        assert len(data["columns"]) == 3
        assert "id" in data
        
        # Store for cleanup
        TestCustomViewsAPI.created_view_id = data["id"]
        print(f"✓ Created custom view with ID: {data['id']}")
    
    def test_get_single_custom_view(self, api_client):
        """Test GET /api/custom-views/{id} - Get specific view"""
        # Use the existing test view
        response = api_client.get(f"{BASE_URL}/api/custom-views/")
        views = response.json()
        existing_view = next((v for v in views if v["nome"] == "Vista de Teste"), None)
        
        assert existing_view is not None
        view_id = existing_view["id"]
        
        response = api_client.get(f"{BASE_URL}/api/custom-views/{view_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == view_id
        assert data["nome"] == "Vista de Teste"
        print(f"✓ Retrieved view: {data['nome']}")


class TestCustomViewData:
    """Test Custom View data retrieval and inline editing"""
    
    def test_get_view_data(self, api_client):
        """Test GET /api/custom-views/{id}/data - Get data for a view"""
        # Get the test view
        response = api_client.get(f"{BASE_URL}/api/custom-views/")
        views = response.json()
        test_view = next((v for v in views if v["nome"] == "Vista de Teste"), None)
        
        assert test_view is not None
        view_id = test_view["id"]
        
        response = api_client.get(f"{BASE_URL}/api/custom-views/{view_id}/data")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        assert "total" in data
        assert "view" in data
        
        # Verify data structure
        if len(data["data"]) > 0:
            project = data["data"][0]
            assert "id" in project
            assert "of_numero" in project
            print(f"✓ View data retrieved: {len(data['data'])} projects, total: {data['total']}")
        else:
            print("⚠ No project data in view (may be expected)")
    
    def test_inline_edit_field(self, api_client):
        """Test PATCH /api/custom-views/{id}/data/{project_id} - Inline edit"""
        # Get view and first project
        response = api_client.get(f"{BASE_URL}/api/custom-views/")
        views = response.json()
        test_view = next((v for v in views if v["nome"] == "Vista de Teste"), None)
        
        assert test_view is not None
        view_id = test_view["id"]
        
        # Get view data with projects
        response = api_client.get(f"{BASE_URL}/api/custom-views/{view_id}/data")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) == 0:
            pytest.skip("No projects to edit")
        
        project = data["data"][0]
        project_id = project["id"]
        original_value = project.get("modelo", "Original")
        
        # Edit the modelo field
        new_value = f"Pytest Edit {uuid.uuid4().hex[:6]}"
        edit_payload = {
            "field": "modelo",
            "value": new_value
        }
        
        response = api_client.patch(
            f"{BASE_URL}/api/custom-views/{view_id}/data/{project_id}",
            json=edit_payload
        )
        assert response.status_code == 200
        
        result = response.json()
        assert result["success"] is True
        assert result["field"] == "modelo"
        assert result["new_value"] == new_value
        assert result["project_id"] == project_id
        print(f"✓ Inline edit successful: '{original_value}' → '{new_value}'")
    
    def test_inline_edit_creates_audit_trail(self, api_client):
        """Test that inline edit creates history entry"""
        # Get view and project
        response = api_client.get(f"{BASE_URL}/api/custom-views/")
        views = response.json()
        test_view = next((v for v in views if v["nome"] == "Vista de Teste"), None)
        
        assert test_view is not None
        view_id = test_view["id"]
        
        response = api_client.get(f"{BASE_URL}/api/custom-views/{view_id}/data")
        data = response.json()
        
        if len(data["data"]) == 0:
            pytest.skip("No projects to edit")
        
        project_id = data["data"][0]["id"]
        
        # Make an edit to trigger history
        edit_value = f"Audit Test {uuid.uuid4().hex[:6]}"
        response = api_client.patch(
            f"{BASE_URL}/api/custom-views/{view_id}/data/{project_id}",
            json={"field": "modelo", "value": edit_value}
        )
        assert response.status_code == 200
        
        # Check history endpoint
        response = api_client.get(
            f"{BASE_URL}/api/history/",
            params={"entidade": "project", "entidade_id": project_id, "limit": 5}
        )
        assert response.status_code == 200
        
        history = response.json()
        assert len(history) > 0
        
        # Verify latest entry is our edit
        latest = history[0]
        assert latest["entidade"] == "project"
        assert latest["entidade_id"] == project_id
        assert latest["campo"] == "modelo"
        assert latest["valor_novo"] == edit_value
        print("✓ Audit trail created for edit")
    
    def test_edit_non_editable_field_fails(self, api_client):
        """Test that editing a non-editable field returns 403"""
        # Get view and project
        response = api_client.get(f"{BASE_URL}/api/custom-views/")
        views = response.json()
        test_view = next((v for v in views if v["nome"] == "Vista de Teste"), None)
        
        assert test_view is not None
        view_id = test_view["id"]
        
        response = api_client.get(f"{BASE_URL}/api/custom-views/{view_id}/data")
        data = response.json()
        
        if len(data["data"]) == 0:
            pytest.skip("No projects to edit")
        
        project_id = data["data"][0]["id"]
        
        # Try to edit 'of_numero' which is not editable in the view
        response = api_client.patch(
            f"{BASE_URL}/api/custom-views/{view_id}/data/{project_id}",
            json={"field": "of_numero", "value": "NewOF001"}
        )
        assert response.status_code == 403
        print("✓ Non-editable field correctly rejected with 403")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_views(self, api_client):
        """Clean up TEST_ prefixed views"""
        response = api_client.get(f"{BASE_URL}/api/custom-views/")
        views = response.json()
        
        deleted_count = 0
        for view in views:
            if view["nome"].startswith("TEST_"):
                delete_response = api_client.delete(f"{BASE_URL}/api/custom-views/{view['id']}")
                if delete_response.status_code == 204:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test views")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
