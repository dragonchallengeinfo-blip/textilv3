import requests
import sys
import json
from datetime import datetime

class TimelineAPITester:
    def __init__(self, base_url="https://error-fix-55.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_project_id = None
        self.test_event_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.text else {}
                    return success, response_data
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test login with admin credentials"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@textil.pt", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            print(f"   User role: {response.get('user', {}).get('role', 'N/A')}")
            return True
        return False

    def test_get_projects(self):
        """Get list of projects to find one for timeline testing"""
        success, response = self.run_test(
            "Get Projects List",
            "GET",
            "projects/",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            # Use first project for testing
            self.test_project_id = response[0]['id']
            print(f"   Found {len(response)} projects")
            print(f"   Using project ID: {self.test_project_id}")
            print(f"   Project: {response[0].get('of_numero', 'N/A')} - {response[0].get('modelo', 'N/A')}")
            return True
        else:
            print(f"   ❌ No projects found or invalid response")
            return False

    def test_timeline_types(self):
        """Test getting timeline event and problem types"""
        success, response = self.run_test(
            "Get Timeline Types",
            "GET",
            "timeline/types",
            200
        )
        
        if success and 'event_types' in response and 'problem_types' in response:
            print(f"   Event types: {len(response['event_types'])}")
            print(f"   Problem types: {len(response['problem_types'])}")
            
            # Check required event types
            event_types = [e['value'] for e in response['event_types']]
            required_types = ['inicio', 'pausa', 'retoma', 'problema', 'problema_resolvido', 'nota']
            missing_types = [t for t in required_types if t not in event_types]
            
            if missing_types:
                print(f"   ❌ Missing event types: {missing_types}")
                return False
            else:
                print(f"   ✅ All required event types present")
                return True
        return False

    def test_get_complete_timeline_all(self):
        """Test GET /api/timeline/{project_id}/complete - all events"""
        if not self.test_project_id:
            print("   ❌ No test project ID available")
            return False
            
        success, response = self.run_test(
            "Get Complete Timeline (All)",
            "GET", 
            f"timeline/{self.test_project_id}/complete",
            200
        )
        
        if success:
            required_keys = ['projeto', 'eventos', 'eventos_por_data', 'estatisticas']
            missing_keys = [k for k in required_keys if k not in response]
            
            if missing_keys:
                print(f"   ❌ Missing response keys: {missing_keys}")
                return False
            
            # Check project info
            projeto = response['projeto']
            print(f"   Project: {projeto.get('of_numero', 'N/A')} - {projeto.get('modelo', 'N/A')}")
            print(f"   Status: {projeto.get('status', 'N/A')}")
            
            # Check events
            eventos = response['eventos']
            print(f"   Total events: {len(eventos)}")
            
            # Check statistics
            stats = response['estatisticas']
            print(f"   Stats - Total: {stats.get('total_eventos', 0)}")
            print(f"   Stats - Active problems: {stats.get('problemas_ativos', 0)}")
            print(f"   Stats - Checkpoints: {stats.get('checkpoints_respondidos', 0)}")
            print(f"   Stats - Changes: {stats.get('total_alteracoes', 0)}")
            print(f"   Stats - Authors: {stats.get('autores_unicos', 0)}")
            
            # Check grouped by date
            eventos_por_data = response['eventos_por_data']
            print(f"   Events grouped by {len(eventos_por_data)} dates")
            
            # Check event sources
            sources = {}
            for evento in eventos:
                source = evento.get('source', 'unknown')
                sources[source] = sources.get(source, 0) + 1
            print(f"   Event sources: {sources}")
            
            # Check author information
            events_with_authors = [e for e in eventos if e.get('autor_nome') and e.get('autor_email')]
            print(f"   Events with author info: {len(events_with_authors)}/{len(eventos)}")
            
            return True
        return False

    def test_get_complete_timeline_filtered(self):
        """Test timeline filters: timeline, history, checkpoint"""
        if not self.test_project_id:
            print("   ❌ No test project ID available")
            return False
        
        filters = ['timeline', 'history', 'checkpoint']
        filter_results = {}
        
        for filtro in filters:
            success, response = self.run_test(
                f"Get Complete Timeline (Filter: {filtro})",
                "GET",
                f"timeline/{self.test_project_id}/complete?filtro_tipo={filtro}",
                200
            )
            
            if success and 'eventos' in response:
                # Check that events match the filter
                eventos = response['eventos']
                filter_results[filtro] = len(eventos)
                
                # Verify event sources match filter
                expected_sources = {
                    'timeline': ['timeline'],
                    'history': ['history', 'system'],  # system events are part of history
                    'checkpoint': ['checkpoint']
                }
                
                invalid_events = []
                for evento in eventos:
                    source = evento.get('source', '')
                    if source not in expected_sources[filtro]:
                        invalid_events.append(f"{evento.get('id', 'unknown')}({source})")
                
                if invalid_events:
                    print(f"   ❌ Filter {filtro} has invalid events: {invalid_events[:5]}")
                    return False
                else:
                    print(f"   ✅ Filter {filtro}: {len(eventos)} events, all valid sources")
            else:
                print(f"   ❌ Filter {filtro} failed")
                return False
        
        print(f"   Summary - Timeline: {filter_results.get('timeline', 0)}, History: {filter_results.get('history', 0)}, Checkpoints: {filter_results.get('checkpoint', 0)}")
        return True

    def test_add_timeline_event(self):
        """Test adding a timeline event (problem)"""
        if not self.test_project_id:
            print("   ❌ No test project ID available")
            return False
        
        event_data = {
            "projeto_id": self.test_project_id,  # Required by model even though it's in URL
            "tipo_evento": "problema",
            "tipo_problema": "falta_material", 
            "descricao": f"Teste problema - {datetime.now().strftime('%H:%M:%S')}",
            "impacto_dias": 2,
            "resolvido": False
        }
        
        success, response = self.run_test(
            "Add Timeline Problem Event",
            "POST",
            f"timeline/{self.test_project_id}",
            200,
            data=event_data
        )
        
        if success and 'id' in response:
            self.test_event_id = response['id']
            print(f"   Created event ID: {self.test_event_id}")
            print(f"   Event type: {response.get('tipo_evento', 'N/A')}")
            print(f"   Description: {response.get('descricao', 'N/A')}")
            print(f"   Impact days: {response.get('impacto_dias', 0)}")
            print(f"   Author: {response.get('criado_por_nome', 'N/A')}")
            return True
        return False

    def test_resolve_problem_event(self):
        """Test resolving a problem event"""
        if not self.test_project_id or not self.test_event_id:
            print("   ❌ No test project/event ID available")
            return False
        
        success, response = self.run_test(
            "Resolve Problem Event",
            "PATCH",
            f"timeline/{self.test_project_id}/event/{self.test_event_id}",
            200,
            data={"resolvido": True}
        )
        
        if success:
            print(f"   ✅ Problem marked as resolved")
            print(f"   Event resolved: {response.get('resolvido', False)}")
            return True
        return False

    def test_timeline_statistics(self):
        """Test that timeline statistics are accurate"""
        if not self.test_project_id:
            print("   ❌ No test project ID available")
            return False
        
        # Get complete timeline to verify statistics
        success, response = self.run_test(
            "Verify Timeline Statistics",
            "GET",
            f"timeline/{self.test_project_id}/complete",
            200
        )
        
        if success:
            eventos = response['eventos']
            stats = response['estatisticas']
            
            # Verify total events
            actual_total = len(eventos)
            reported_total = stats.get('total_eventos', 0)
            
            if actual_total != reported_total:
                print(f"   ❌ Total events mismatch: actual {actual_total} vs reported {reported_total}")
                return False
            
            # Verify events by source
            por_fonte = stats.get('por_fonte', {})
            actual_sources = {}
            for evento in eventos:
                source = evento.get('source', 'unknown')
                actual_sources[source] = actual_sources.get(source, 0) + 1
            
            for source, count in por_fonte.items():
                if actual_sources.get(source, 0) != count:
                    print(f"   ❌ Source {source} count mismatch: actual {actual_sources.get(source, 0)} vs reported {count}")
                    return False
            
            # Verify active problems
            active_problems = len([e for e in eventos if e.get('tipo') == 'problema' and not e.get('resolvido')])
            reported_active = stats.get('problemas_ativos', 0)
            
            if active_problems != reported_active:
                print(f"   ❌ Active problems mismatch: actual {active_problems} vs reported {reported_active}")
                return False
            
            # Verify unique authors
            unique_authors = len(set(e.get('autor_id') for e in eventos if e.get('autor_id')))
            reported_authors = stats.get('autores_unicos', 0)
            
            if unique_authors != reported_authors:
                print(f"   ❌ Unique authors mismatch: actual {unique_authors} vs reported {reported_authors}")
                return False
            
            print(f"   ✅ All statistics verified correctly")
            print(f"   - Total events: {actual_total}")
            print(f"   - Active problems: {active_problems}")
            print(f"   - Unique authors: {unique_authors}")
            print(f"   - Sources: {actual_sources}")
            
            return True
        return False

def main():
    print("🧪 Testing Timeline Functionality - SAMIDEL")
    print("=" * 60)
    
    tester = TimelineAPITester()
    
    print("\n📋 TESTING TIMELINE API")
    print("-" * 50)
    
    # Test login first
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1

    # Get projects to test with
    if not tester.test_get_projects():
        print("❌ Could not get projects for testing")
        return 1

    # Test timeline types
    if not tester.test_timeline_types():
        print("❌ Timeline types test failed")
        return 1

    # Test main complete timeline endpoint  
    if not tester.test_get_complete_timeline_all():
        print("❌ Complete timeline (all) test failed")
        return 1

    # Test timeline filters
    if not tester.test_get_complete_timeline_filtered():
        print("❌ Timeline filters test failed")
        return 1

    # Test adding timeline event
    if not tester.test_add_timeline_event():
        print("❌ Add timeline event test failed")
        return 1

    # Test resolving problem
    if not tester.test_resolve_problem_event():
        print("❌ Resolve problem event test failed") 
        return 1

    # Test statistics accuracy
    if not tester.test_timeline_statistics():
        print("❌ Timeline statistics test failed")
        return 1

    print(f"\n📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All timeline backend tests passed!")
        return 0
    else:
        print("⚠️  Some timeline tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())