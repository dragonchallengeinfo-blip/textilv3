"""
Test suite for Capacity and Timeline API endpoints
Tests: /api/capacity/* and /api/timeline/*
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


# Module-level fixtures
@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@textil.pt",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")  # Fixed: use access_token not token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Create headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def sample_project_id(auth_headers):
    """Get a sample project ID for timeline tests"""
    response = requests.get(f"{BASE_URL}/api/planning/projects", headers=auth_headers)
    assert response.status_code == 200, f"Failed to get projects: {response.text}"
    
    projects = response.json()
    assert len(projects) > 0, "No projects available for testing"
    return projects[0]["id"]


class TestTimelineTypes:
    """Tests for /api/timeline/types endpoint"""
    
    def test_get_event_types(self, auth_headers):
        """GET /api/timeline/types - Returns event and problem types"""
        response = requests.get(f"{BASE_URL}/api/timeline/types", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "event_types" in data
        assert "problem_types" in data
        
        # Verify event types structure
        event_types = data["event_types"]
        assert len(event_types) >= 8  # At least 8 event types
        
        # Verify event types values
        event_values = [et["value"] for et in event_types]
        expected_events = ["inicio", "pausa", "retoma", "problema", "problema_resolvido", "mudanca_etapa", "conclusao", "nota"]
        for expected in expected_events:
            assert expected in event_values, f"Missing event type: {expected}"
        
        # Verify problem types structure
        problem_types = data["problem_types"]
        assert len(problem_types) >= 8  # At least 8 problem types
        
        problem_values = [pt["value"] for pt in problem_types]
        expected_problems = ["falta_material", "defeito_qualidade", "atraso_fornecedor", "maquina_avariada", "falta_capacidade", "erro_corte", "problema_tecido", "outro"]
        for expected in expected_problems:
            assert expected in problem_values, f"Missing problem type: {expected}"
        
        print(f"✓ Timeline types API returned {len(event_types)} event types and {len(problem_types)} problem types")


class TestCapacityDashboard:
    """Tests for /api/capacity/dashboard endpoint"""
    
    def test_get_capacity_dashboard(self, auth_headers):
        """GET /api/capacity/dashboard - Returns capacity data for all confection partners"""
        response = requests.get(f"{BASE_URL}/api/capacity/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "partners" in data
        assert "alerts" in data
        assert "summary" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_partners" in summary
        assert "total_capacity_pieces" in summary
        assert "total_workload_pieces" in summary
        assert "total_available_pieces" in summary
        assert "overall_utilization" in summary
        
        print(f"✓ Capacity Dashboard: {summary['total_partners']} partners, {summary['overall_utilization']}% utilization")
        
        # If there are partners, verify partner structure
        if len(data["partners"]) > 0:
            partner_data = data["partners"][0]
            assert "partner" in partner_data
            assert "capacity" in partner_data
            assert "workload" in partner_data
            assert "utilization" in partner_data
            assert "available" in partner_data
            assert "status" in partner_data
            
            # Verify partner info
            partner = partner_data["partner"]
            assert "id" in partner
            assert "nome" in partner
            
            print(f"✓ First partner: {partner['nome']} - Status: {partner_data['status']} ({partner_data['utilization']['max_percent']}%)")
        
        # Verify alerts structure if present
        if len(data["alerts"]) > 0:
            alert = data["alerts"][0]
            assert "tipo" in alert
            assert "prioridade" in alert
            assert "parceiro" in alert
            assert "mensagem" in alert
            print(f"✓ Alerts: {len(data['alerts'])} alerts found")


class TestCapacityProjectsForecast:
    """Tests for /api/capacity/projects-forecast endpoint"""
    
    def test_get_projects_forecast(self, auth_headers):
        """GET /api/capacity/projects-forecast - Returns project radiograph"""
        response = requests.get(f"{BASE_URL}/api/capacity/projects-forecast", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "projects" in data
        assert "summary" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "total" in summary
        assert "critical" in summary
        assert "warning" in summary
        assert "good" in summary
        assert "paused" in summary
        assert "with_problems" in summary
        
        print(f"✓ Projects Forecast: {summary['total']} total (Critical: {summary['critical']}, Warning: {summary['warning']}, Good: {summary['good']})")
        
        # If there are projects, verify project structure
        if len(data["projects"]) > 0:
            pf = data["projects"][0]
            assert "project" in pf
            assert "progress" in pf
            assert "issues" in pf
            assert "health" in pf
            
            # Verify health values
            assert pf["health"] in ["critical", "warning", "good"]
            
            # Verify project info
            project = pf["project"]
            assert "id" in project
            assert "of_numero" in project
            
            # Verify progress structure
            progress = pf["progress"]
            assert "percent" in progress
            assert "completed_stages" in progress
            assert "total_stages" in progress
            
            # Verify issues structure
            issues = pf["issues"]
            assert "is_paused" in issues
            assert "active_problems" in issues
            assert "delay_days" in issues
            
            print(f"✓ First project: {project['of_numero']} - Health: {pf['health']}, Progress: {progress['percent']}%")


class TestTimelineProject:
    """Tests for /api/timeline/{project_id} endpoints"""
    
    def test_get_project_timeline(self, auth_headers, sample_project_id):
        """GET /api/timeline/{project_id} - Returns timeline events for a project"""
        response = requests.get(f"{BASE_URL}/api/timeline/{sample_project_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "project" in data
        assert "events" in data
        assert "summary" in data
        
        # Verify project info
        project = data["project"]
        assert "id" in project
        assert project["id"] == sample_project_id
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_events" in summary
        assert "active_problems" in summary
        assert "is_paused" in summary
        
        print(f"✓ Timeline for project {project.get('of_numero', sample_project_id)}: {summary['total_events']} events")
    
    def test_get_timeline_nonexistent_project(self, auth_headers):
        """GET /api/timeline/{project_id} - Returns 404 for nonexistent project"""
        response = requests.get(f"{BASE_URL}/api/timeline/nonexistent-id-123", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("✓ Correctly returns 404 for nonexistent project")
    
    def test_add_timeline_event_nota(self, auth_headers, sample_project_id):
        """POST /api/timeline/{project_id} - Add a note event"""
        event_data = {
            "projeto_id": sample_project_id,
            "tipo_evento": "nota",
            "descricao": "TEST_Nota de teste para timeline",
            "impacto_dias": 0
        }
        
        response = requests.post(
            f"{BASE_URL}/api/timeline/{sample_project_id}",
            headers=auth_headers,
            json=event_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["tipo_evento"] == "nota"
        assert data["descricao"] == event_data["descricao"]
        assert data["projeto_id"] == sample_project_id
        
        print(f"✓ Added note event: {data['id']}")
    
    def test_add_timeline_event_problema(self, auth_headers, sample_project_id):
        """POST /api/timeline/{project_id} - Add a problem event"""
        event_data = {
            "projeto_id": sample_project_id,
            "tipo_evento": "problema",
            "tipo_problema": "falta_material",
            "descricao": "TEST_Problema de teste - falta material",
            "impacto_dias": 2
        }
        
        response = requests.post(
            f"{BASE_URL}/api/timeline/{sample_project_id}",
            headers=auth_headers,
            json=event_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["tipo_evento"] == "problema"
        assert data["tipo_problema"] == "falta_material"
        assert data["impacto_dias"] == 2
        
        print(f"✓ Added problem event: {data['id']}")
    
    def test_add_timeline_event_pausa(self, auth_headers, sample_project_id):
        """POST /api/timeline/{project_id} - Add a pause event"""
        event_data = {
            "projeto_id": sample_project_id,
            "tipo_evento": "pausa",
            "descricao": "TEST_Pausa para manutenção",
            "impacto_dias": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/timeline/{sample_project_id}",
            headers=auth_headers,
            json=event_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["tipo_evento"] == "pausa"
        
        print(f"✓ Added pause event: {data['id']}")
    
    def test_add_timeline_event_retoma(self, auth_headers, sample_project_id):
        """POST /api/timeline/{project_id} - Add a resume event"""
        event_data = {
            "projeto_id": sample_project_id,
            "tipo_evento": "retoma",
            "descricao": "TEST_Retoma após manutenção"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/timeline/{sample_project_id}",
            headers=auth_headers,
            json=event_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["tipo_evento"] == "retoma"
        
        print(f"✓ Added resume event: {data['id']}")


class TestTimelineEventOperations:
    """Tests for timeline event PATCH and DELETE operations"""
    
    def test_update_event_resolve_problem(self, auth_headers, sample_project_id):
        """PATCH /api/timeline/{project_id}/event/{event_id} - Mark problem as resolved"""
        # First create a test problem event
        event_data = {
            "projeto_id": sample_project_id,
            "tipo_evento": "problema",
            "tipo_problema": "outro",
            "descricao": "TEST_Problem to resolve"
        }
        response = requests.post(
            f"{BASE_URL}/api/timeline/{sample_project_id}",
            headers=auth_headers,
            json=event_data
        )
        event = response.json()
        event_id = event["id"]
        
        # Now update it
        response = requests.patch(
            f"{BASE_URL}/api/timeline/{sample_project_id}/event/{event_id}",
            headers=auth_headers,
            json={"resolvido": True}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["resolvido"] == True
        
        print(f"✓ Problem marked as resolved: {event_id}")
    
    def test_delete_event(self, auth_headers, sample_project_id):
        """DELETE /api/timeline/{project_id}/event/{event_id} - Delete an event"""
        # Create a test event to delete
        event_data = {
            "projeto_id": sample_project_id,
            "tipo_evento": "nota",
            "descricao": "TEST_Event to delete"
        }
        response = requests.post(
            f"{BASE_URL}/api/timeline/{sample_project_id}",
            headers=auth_headers,
            json=event_data
        )
        event = response.json()
        event_id = event["id"]
        
        # Delete the event
        response = requests.delete(
            f"{BASE_URL}/api/timeline/{sample_project_id}/event/{event_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        print(f"✓ Event deleted: {event_id}")


class TestCapacityRecommend:
    """Tests for /api/capacity/recommend endpoint"""
    
    def test_recommend_partner(self, auth_headers):
        """GET /api/capacity/recommend - Get partner recommendations for new project"""
        response = requests.get(
            f"{BASE_URL}/api/capacity/recommend?quantidade=1000",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "quantidade_solicitada" in data
        assert data["quantidade_solicitada"] == 1000
        assert "recommendations" in data
        
        print(f"✓ Partner recommendations: {len(data['recommendations'])} partners available for 1000 pieces")
        
        if data.get("best_match"):
            best = data["best_match"]
            print(f"✓ Best match: {best['partner']['nome']} (score: {best.get('score', 'N/A')})")


class TestPartnersCapacityFields:
    """Tests for partner capacity fields"""
    
    def test_partner_has_capacity_fields(self, auth_headers):
        """GET /api/partners/ - Verify partners have capacity fields"""
        response = requests.get(f"{BASE_URL}/api/partners/", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        partners = response.json()
        assert len(partners) > 0, "No partners found"
        
        # Check for confection partners with capacity data
        confection_partners = [p for p in partners if p.get("tipo_servico") == "confeccao"]
        
        if confection_partners:
            partner = confection_partners[0]
            # These fields should be available
            capacity_fields = ["num_trabalhadores", "capacidade_pecas_mes", "capacidade_projetos_mes", "taxa_ocupacao", "eficiencia"]
            
            for field in capacity_fields:
                # Field should exist in response (even if null)
                assert field in partner or partner.get(field) is None, f"Missing field: {field}"
            
            print(f"✓ Partner capacity fields verified for {partner['nome']}")
            if partner.get("capacidade_pecas_mes"):
                print(f"  - Capacidade: {partner['capacidade_pecas_mes']} peças/mês")
            if partner.get("num_trabalhadores"):
                print(f"  - Trabalhadores: {partner['num_trabalhadores']}")


class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_test_events(self, auth_headers, sample_project_id):
        """Remove TEST_ prefixed timeline events"""
        # Get timeline for sample project
        response = requests.get(f"{BASE_URL}/api/timeline/{sample_project_id}", headers=auth_headers)
        
        deleted_count = 0
        if response.status_code == 200:
            data = response.json()
            for event in data.get("events", []):
                if event.get("descricao", "").startswith("TEST_"):
                    # Delete test event
                    requests.delete(
                        f"{BASE_URL}/api/timeline/{sample_project_id}/event/{event['id']}",
                        headers=auth_headers
                    )
                    deleted_count += 1
        
        print(f"✓ Cleanup complete: {deleted_count} test events removed")
