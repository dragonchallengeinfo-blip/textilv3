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

    def test_producao_login(self):
        """Test login with producao credentials"""
        success, response = self.run_test(
            "Producao Login",
            "POST",
            "auth/login", 
            200,
            data={"email": "producao@textil.pt", "password": "producao123"}
        )
        if success and 'access_token' in response:
            print(f"   Producao login successful")
            print(f"   User role: {response.get('user', {}).get('role', 'N/A')}")
            return True
        return False

    def test_create_view_with_ordem(self):
        """Test creating a custom view with 'ordem' field (Order of Presentation)"""
        view_data = {
            "nome": f"Lista Produção {datetime.now().strftime('%H%M%S')}",
            "descricao": "Lista ordenada para produção",
            "entidade": "project",
            "columns": [
                {"field": "of_numero", "label": "Nº OF", "type": "text", "editable": False},
                {"field": "modelo", "label": "Modelo", "type": "text", "editable": True},
                {"field": "status_projeto", "label": "Status", "type": "status", "editable": False}
            ],
            "is_public": True,
            "allowed_roles": ["admin", "producao", "comercial"],
            "edit_roles": ["admin", "producao"],
            "ordem": 1
        }
        
        success, response = self.run_test(
            "Create View with Ordem Field",
            "POST",
            "custom-views/",
            201,
            data=view_data
        )
        
        if success and 'id' in response:
            self.created_view_ids.append(response['id'])
            print(f"   Created view ID: {response['id']}")
            print(f"   View ordem: {response.get('ordem', 'N/A')}")
            return True, response
        return False, {}

    def test_create_view_with_status_filter(self):
        """Test creating a custom view with 'status_filter' (Filter by States)"""
        view_data = {
            "nome": f"Lista Projetos Ativos {datetime.now().strftime('%H%M%S')}",
            "descricao": "Apenas projetos ativos e atrasados", 
            "entidade": "project",
            "columns": [
                {"field": "of_numero", "label": "Nº OF", "type": "text", "editable": False},
                {"field": "modelo", "label": "Modelo", "type": "text", "editable": True},
                {"field": "status_projeto", "label": "Status", "type": "status", "editable": False},
                {"field": "data_prevista_entrega", "label": "Data Entrega", "type": "date", "editable": True}
            ],
            "is_public": True,
            "allowed_roles": ["admin", "producao", "comercial"],
            "edit_roles": ["admin", "producao"],
            "ordem": 2,
            "status_filter": ["ativo", "atrasado"]
        }
        
        success, response = self.run_test(
            "Create View with Status Filter",
            "POST",
            "custom-views/",
            201,
            data=view_data
        )
        
        if success and 'id' in response:
            self.created_view_ids.append(response['id'])
            print(f"   Created view ID: {response['id']}")
            print(f"   View status filter: {response.get('status_filter', 'N/A')}")
            print(f"   View ordem: {response.get('ordem', 'N/A')}")
            return True, response
        return False, {}

    def test_get_views_ordered_by_ordem(self):
        """Test that custom views are returned ordered by 'ordem' field"""
        success, response = self.run_test(
            "Get Views Ordered by Ordem",
            "GET",
            "custom-views/",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} custom views")
            
            # Check if views with 'ordem' are ordered correctly
            views_with_ordem = [v for v in response if v.get('ordem', 0) > 0]
            if len(views_with_ordem) >= 2:
                print(f"   Found {len(views_with_ordem)} views with ordem > 0")
                
                # Check ordering
                ordens = [v.get('ordem', 0) for v in views_with_ordem]
                is_ordered = all(ordens[i] <= ordens[i+1] for i in range(len(ordens)-1))
                
                if is_ordered:
                    print(f"   ✅ Views are ordered correctly by ordem: {ordens}")
                    return True
                else:
                    print(f"   ❌ Views not ordered correctly: {ordens}")
                    return False
            else:
                print(f"   ⚠️  Not enough views with ordem to test ordering")
                return True
        return False

    def test_get_view_data(self, view_id):
        """Test getting data for a specific view - tests the /view/:id functionality"""
        success, response = self.run_test(
            f"Get View Data (ID: {view_id})",
            "GET",
            f"custom-views/{view_id}/data",
            200
        )
        
        if success:
            if 'data' in response and 'view' in response:
                projects = response['data']
                view = response['view']
                print(f"   ✅ Retrieved {len(projects)} projects")
                print(f"   ✅ View has {len(view.get('columns', []))} columns")
                print(f"   ✅ View name: {view.get('nome', 'N/A')}")
                
                # Check status filter if present
                if view.get('status_filter'):
                    print(f"   ✅ Status filter applied: {view['status_filter']}")
                    # Check if returned projects match the filter
                    if projects:
                        project_statuses = [p.get('status_projeto') for p in projects if p.get('status_projeto')]
                        filtered_statuses = [s for s in project_statuses if s in view['status_filter']]
                        print(f"   ✅ Projects with matching status: {len(filtered_statuses)}/{len(project_statuses)}")
                
                return True
            else:
                print("   ❌ Invalid response structure")
                return False
        return False

    def test_cleanup(self):
        """Clean up created test data"""
        success_count = 0
        for view_id in self.created_view_ids:
            success, _ = self.run_test(
                f"Delete Test View {view_id}",
                "DELETE",
                f"custom-views/{view_id}",
                204
            )
            if success:
                success_count += 1
        
        print(f"   ✅ Cleaned up {success_count}/{len(self.created_view_ids)} test views")
        return success_count == len(self.created_view_ids)

def main():
    print("🧪 Testing Custom Listings Improvements - SAMIDEL")
    print("=" * 60)
    
    tester = CustomListingsAPITester()
    
    print("\n📋 TESTING CUSTOM LISTINGS API IMPROVEMENTS")
    print("-" * 50)
    
    # Test admin login first
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1

    # Test producao login (separate test)
    if not tester.test_producao_login():
        print("❌ Producao login failed")
        return 1

    # Reset token to admin for creation tests
    if not tester.test_admin_login():
        print("❌ Could not get admin token for creation tests")
        return 1

    # Test creating view with ordem field
    success, view1_data = tester.test_create_view_with_ordem()
    if not success:
        print("❌ Failed to create view with ordem field")
        return 1

    # Test creating view with status filter
    success, view2_data = tester.test_create_view_with_status_filter()
    if not success:
        print("❌ Failed to create view with status filter")
        return 1

    # Test ordering by ordem
    if not tester.test_get_views_ordered_by_ordem():
        print("❌ Views not properly ordered by ordem")
        return 1

    # Test view data retrieval (for /view/:id route)
    if tester.created_view_ids:
        if not tester.test_get_view_data(tester.created_view_ids[0]):
            print("❌ Failed to get view data for first created view")
            return 1

        if len(tester.created_view_ids) > 1:
            if not tester.test_get_view_data(tester.created_view_ids[1]):
                print("❌ Failed to get view data for second created view")
                return 1

    # Cleanup
    tester.test_cleanup()

    print(f"\n📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed! Custom Listings improvements working correctly.")
        return 0
    else:
        print("⚠️  Some backend tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())