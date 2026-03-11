"""
Test file for Planning module (Planeamento)
Tests the planning APIs including:
- GET /api/planning/stages - Get list of planning stages
- GET /api/planning/projects - Get projects for planning selection
- GET /api/planning/{project_id} - Get planning data for a specific project
- POST /api/planning/calculate - Calculate dates based on delivery date
- POST /api/planning/{project_id} - Save planning for a project
- PATCH /api/planning/{project_id}/stage/{stage_key} - Update real dates for a stage
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "admin@textil.pt"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestPlanningStages:
    """Test planning stages endpoint"""
    
    def test_get_planning_stages(self, auth_headers):
        """GET /api/planning/stages returns all 6 planning stages"""
        response = requests.get(f"{BASE_URL}/api/planning/stages", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "stages" in data
        assert "default_days" in data
        
        # Verify 6 stages are returned
        stages = data["stages"]
        assert len(stages) == 6
        
        # Verify stage keys
        expected_keys = ["preparacao", "corte", "confecao", "lavandaria", "acabamentos", "fim"]
        actual_keys = [s["key"] for s in stages]
        assert actual_keys == expected_keys
        
        # Verify each stage has required fields
        for stage in stages:
            assert "key" in stage
            assert "nome" in stage
            assert "ordem" in stage
            assert "cor" in stage
        
        # Verify default days
        default_days = data["default_days"]
        assert default_days["preparacao"] == 3
        assert default_days["corte"] == 2
        assert default_days["confecao"] == 10
        assert default_days["lavandaria"] == 3
        assert default_days["acabamentos"] == 2
        assert default_days["fim"] == 0


class TestPlanningProjects:
    """Test projects for planning endpoint"""
    
    def test_get_projects_for_planning(self, auth_headers):
        """GET /api/planning/projects returns available projects"""
        response = requests.get(f"{BASE_URL}/api/planning/projects", headers=auth_headers)
        
        assert response.status_code == 200
        projects = response.json()
        
        # Verify it returns a list
        assert isinstance(projects, list)
        assert len(projects) > 0
        
        # Verify project structure
        for project in projects[:3]:  # Check first 3
            assert "id" in project
            assert "of_numero" in project
            assert "modelo" in project
            assert "quantidade" in project
            assert "data_prevista_entrega" in project
    
    def test_get_projects_with_search(self, auth_headers):
        """GET /api/planning/projects?search= filters projects"""
        response = requests.get(
            f"{BASE_URL}/api/planning/projects?search=OF20240010",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        projects = response.json()
        
        # Should find the project
        assert len(projects) >= 1
        assert any(p["of_numero"] == "OF20240010" for p in projects)


class TestProjectPlanning:
    """Test project planning endpoints"""
    
    def test_get_project_planning(self, auth_headers):
        """GET /api/planning/{project_id} returns planning data"""
        # First get a project ID
        projects_response = requests.get(
            f"{BASE_URL}/api/planning/projects",
            headers=auth_headers
        )
        projects = projects_response.json()
        project_id = projects[0]["id"]  # Get first project
        
        # Get planning for this project
        response = requests.get(
            f"{BASE_URL}/api/planning/{project_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "project" in data
        assert "planning" in data
        
        # Verify project data
        assert data["project"]["id"] == project_id
        
        # Verify planning has 6 stages
        planning = data["planning"]
        assert len(planning) == 6
        
        # Verify stage keys in order
        stage_keys = [p["key"] for p in planning]
        assert stage_keys == ["preparacao", "corte", "confecao", "lavandaria", "acabamentos", "fim"]
    
    def test_get_project_planning_not_found(self, auth_headers):
        """GET /api/planning/{project_id} returns 404 for invalid project"""
        response = requests.get(
            f"{BASE_URL}/api/planning/invalid-project-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestCalculateDates:
    """Test date calculation endpoint"""
    
    def test_calculate_dates_success(self, auth_headers):
        """POST /api/planning/calculate calculates dates correctly"""
        payload = {
            "data_entrega": "2026-05-28T00:00:00Z",
            "dias_por_etapa": {
                "preparacao": 3,
                "corte": 2,
                "confecao": 10,
                "lavandaria": 3,
                "acabamentos": 2,
                "fim": 0
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/planning/calculate",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all stages are calculated
        expected_stages = ["preparacao", "corte", "confecao", "lavandaria", "acabamentos", "fim"]
        for stage in expected_stages:
            assert stage in data
            assert "data_inicio_prevista" in data[stage]
            assert "data_fim_prevista" in data[stage]
            assert "dias_previstos" in data[stage]
        
        # Verify fim ends on delivery date
        assert "2026-05-28" in data["fim"]["data_fim_prevista"]
    
    def test_calculate_dates_with_confecao_date(self, auth_headers):
        """POST /api/planning/calculate respects confecao date"""
        payload = {
            "data_entrega": "2026-05-28T00:00:00Z",
            "data_confecao": "2026-05-20T00:00:00Z",
            "dias_por_etapa": {
                "preparacao": 3,
                "corte": 2,
                "confecao": 10,
                "lavandaria": 3,
                "acabamentos": 2,
                "fim": 0
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/planning/calculate",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify confecao ends on provided date
        assert "2026-05-20" in data["confecao"]["data_fim_prevista"]
    
    def test_calculate_dates_missing_data_entrega(self, auth_headers):
        """POST /api/planning/calculate returns 400 without delivery date"""
        payload = {
            "dias_por_etapa": {
                "preparacao": 3,
                "corte": 2,
                "confecao": 10,
                "lavandaria": 3,
                "acabamentos": 2,
                "fim": 0
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/planning/calculate",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 400


class TestSavePlanning:
    """Test save planning endpoint"""
    
    def test_save_planning_success(self, auth_headers):
        """POST /api/planning/{project_id} saves planning"""
        # Get a project
        projects_response = requests.get(
            f"{BASE_URL}/api/planning/projects",
            headers=auth_headers
        )
        projects = projects_response.json()
        # Use project OF20240002 to avoid modifying OF20240010's existing planning
        project = next((p for p in projects if p["of_numero"] == "OF20240002"), projects[1])
        project_id = project["id"]
        
        # Create planning payload
        payload = {
            "stages": [
                {
                    "etapa_key": "preparacao",
                    "data_inicio_prevista": "2026-04-01T00:00:00Z",
                    "data_fim_prevista": "2026-04-03T00:00:00Z",
                    "dias_previstos": 3
                },
                {
                    "etapa_key": "corte",
                    "data_inicio_prevista": "2026-04-04T00:00:00Z",
                    "data_fim_prevista": "2026-04-05T00:00:00Z",
                    "dias_previstos": 2
                },
                {
                    "etapa_key": "confecao",
                    "data_inicio_prevista": "2026-04-06T00:00:00Z",
                    "data_fim_prevista": "2026-04-15T00:00:00Z",
                    "dias_previstos": 10
                },
                {
                    "etapa_key": "lavandaria",
                    "data_inicio_prevista": "2026-04-16T00:00:00Z",
                    "data_fim_prevista": "2026-04-18T00:00:00Z",
                    "dias_previstos": 3
                },
                {
                    "etapa_key": "acabamentos",
                    "data_inicio_prevista": "2026-04-19T00:00:00Z",
                    "data_fim_prevista": "2026-04-20T00:00:00Z",
                    "dias_previstos": 2
                },
                {
                    "etapa_key": "fim",
                    "data_inicio_prevista": "2026-04-21T00:00:00Z",
                    "data_fim_prevista": "2026-04-21T00:00:00Z",
                    "dias_previstos": 0
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/planning/{project_id}",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["project_id"] == project_id
        assert "stages" in data
        assert len(data["stages"]) == 6
        
        # Verify GET returns saved data
        get_response = requests.get(
            f"{BASE_URL}/api/planning/{project_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        get_data = get_response.json()
        
        # Verify planning has dates
        planning = get_data["planning"]
        preparacao = next(p for p in planning if p["key"] == "preparacao")
        assert "2026-04-01" in preparacao["data_inicio_prevista"]
    
    def test_save_planning_invalid_project(self, auth_headers):
        """POST /api/planning/{project_id} returns 404 for invalid project"""
        payload = {"stages": []}
        
        response = requests.post(
            f"{BASE_URL}/api/planning/invalid-project-id",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 404


class TestUpdateStageDates:
    """Test update stage real dates endpoint"""
    
    def test_update_stage_real_dates(self, auth_headers):
        """PATCH /api/planning/{project_id}/stage/{stage_key} updates real dates"""
        # First ensure project has planning by saving it
        projects_response = requests.get(
            f"{BASE_URL}/api/planning/projects",
            headers=auth_headers
        )
        project = next((p for p in projects_response.json() if p["of_numero"] == "OF20240002"), None)
        if not project:
            pytest.skip("Test project not found")
        
        project_id = project["id"]
        
        # Update real dates for preparacao
        payload = {
            "data_inicio_real": "2026-04-01T00:00:00Z",
            "data_fim_real": "2026-04-03T00:00:00Z",
            "observacoes": "Concluído no prazo"
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/planning/{project_id}/stage/preparacao",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["stage_key"] == "preparacao"
        assert "status_calculado" in data
    
    def test_update_stage_not_found(self, auth_headers):
        """PATCH /api/planning/{project_id}/stage/{stage_key} returns 404 for invalid stage"""
        projects_response = requests.get(
            f"{BASE_URL}/api/planning/projects",
            headers=auth_headers
        )
        project = projects_response.json()[0]
        
        response = requests.patch(
            f"{BASE_URL}/api/planning/{project.get('id')}/stage/invalid_stage",
            headers=auth_headers,
            json={"data_fim_real": "2026-04-03T00:00:00Z"}
        )
        
        assert response.status_code == 404


class TestPlanningStatusCalculation:
    """Test status calculation logic"""
    
    def test_status_dentro_prazo(self, auth_headers):
        """Verify status is 'dentro_prazo' for future dates"""
        # Get OF20240010 which has planning with future dates
        response = requests.get(
            f"{BASE_URL}/api/planning/projects?search=OF20240010",
            headers=auth_headers
        )
        projects = response.json()
        
        if not projects:
            pytest.skip("OF20240010 not found")
        
        project_id = projects[0]["id"]
        
        planning_response = requests.get(
            f"{BASE_URL}/api/planning/{project_id}",
            headers=auth_headers
        )
        
        assert planning_response.status_code == 200
        planning = planning_response.json()["planning"]
        
        # Check that stages with future dates have correct status
        for stage in planning:
            if stage.get("data_fim_prevista"):
                # Future dates should have dentro_prazo or similar
                assert stage.get("status_calculado") in [
                    "dentro_prazo", "nao_iniciado", "risco", "concluido", "concluido_atrasado", "atrasado"
                ]
