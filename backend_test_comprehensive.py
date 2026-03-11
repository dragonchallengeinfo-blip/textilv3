import requests
import sys
import json
from datetime import datetime

class ComprehensiveCustomViewsTester:
    def __init__(self, base_url="https://config-scanner-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_view_id = None
        self.test_project_id = None

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
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers)
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

    def test_login(self):
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
            return True
        return False

    def test_create_public_view_with_roles(self):
        """Test creating a public custom view with allowed_roles and edit_roles"""
        view_data = {
            "nome": f"Test Public View {datetime.now().strftime('%H%M%S')}",
            "descricao": "Test public view with role controls",
            "entidade": "project",
            "columns": [
                {"field": "of_numero", "label": "Nº OF", "type": "text", "editable": False},
                {"field": "modelo", "label": "Modelo", "type": "text", "editable": True},
                {"field": "quantidade", "label": "Quantidade", "type": "number", "editable": True}
            ],
            "is_public": True,
            "allowed_roles": ["admin", "producao", "comercial"],
            "edit_roles": ["admin", "producao"]
        }
        
        success, response = self.run_test(
            "Create Public View with Role Controls",
            "POST",
            "custom-views/",
            201,
            data=view_data
        )
        
        if success and 'id' in response:
            self.created_view_id = response['id']
            print(f"   Created public view ID: {self.created_view_id}")
            
            # Verify the roles were saved correctly
            if response.get('is_public') and response.get('allowed_roles') and response.get('edit_roles'):
                print(f"   ✅ Public view created with allowed_roles: {response['allowed_roles']}")
                print(f"   ✅ Edit roles set to: {response['edit_roles']}")
                return True
            else:
                print(f"   ❌ Role configuration not saved correctly")
                return False
        return False

    def test_create_checkpoint_editable_view(self):
        """Test creating a view with editable checkpoint fields"""
        # First get available checkpoint fields
        success, fields_response = self.run_test(
            "Get Available Fields for Checkpoint Test",
            "GET",
            "custom-views/fields",
            200
        )
        
        if not success:
            return False
        
        # Find checkpoint fields
        checkpoint_fields = []
        if 'grouped_fields' in fields_response and 'checkpoints' in fields_response['grouped_fields']:
            stages = fields_response['grouped_fields']['checkpoints'].get('stages', [])
            for stage in stages:
                checkpoint_fields.extend(stage.get('fields', []))
        
        if not checkpoint_fields:
            print("   ⚠️  No checkpoint fields available for testing")
            return False
        
        # Create view with editable checkpoint
        view_data = {
            "nome": f"Test Checkpoint Editable View {datetime.now().strftime('%H%M%S')}",
            "descricao": "Test view with editable checkpoints",
            "entidade": "project",
            "columns": [
                {"field": "of_numero", "label": "Nº OF", "type": "text", "editable": False},
                {"field": checkpoint_fields[0]["field"], "label": checkpoint_fields[0]["label"], "type": checkpoint_fields[0]["type"], "editable": True}
            ],
            "is_public": False
        }
        
        success, response = self.run_test(
            "Create View with Editable Checkpoint",
            "POST",
            "custom-views/",
            201,
            data=view_data
        )
        
        if success and 'id' in response:
            checkpoint_view_id = response['id']
            print(f"   Created checkpoint view ID: {checkpoint_view_id}")
            
            # Verify checkpoint is marked as editable
            editable_columns = [col for col in response.get('columns', []) if col.get('editable')]
            checkpoint_editable = any(col['field'].startswith('checkpoint_') for col in editable_columns)
            
            if checkpoint_editable:
                print(f"   ✅ Checkpoint field marked as editable")
                
                # Clean up this test view
                self.run_test(
                    "Delete Checkpoint Test View",
                    "DELETE",
                    f"custom-views/{checkpoint_view_id}",
                    204
                )
                return True
            else:
                print(f"   ❌ Checkpoint field not marked as editable")
                return False
        return False

    def test_get_existing_view_data(self):
        """Test getting data from the existing 'Operadores - Checkpoints' view"""
        existing_view_id = "e7b07a84-f096-4c51-b8e5-1c86d1e55a85"
        
        success, response = self.run_test(
            "Get Existing 'Operadores - Checkpoints' View Data",
            "GET",
            f"custom-views/{existing_view_id}/data",
            200
        )
        
        if success:
            if 'data' in response and 'view' in response:
                projects = response['data']
                view = response['view']
                print(f"   Retrieved {len(projects)} projects from existing view")
                print(f"   View name: {view.get('nome', 'Unknown')}")
                
                # Check for checkpoint columns
                checkpoint_columns = [col for col in view.get('columns', []) if col['field'].startswith('checkpoint_')]
                if checkpoint_columns:
                    print(f"   ✅ Found {len(checkpoint_columns)} checkpoint columns")
                    
                    # Store first project ID for editing test
                    if projects:
                        self.test_project_id = projects[0]['id']
                        print(f"   Stored project ID for editing test: {self.test_project_id}")
                    
                    return True
                else:
                    print("   ❌ No checkpoint columns found in existing view")
                    return False
            else:
                print("   ❌ Invalid response structure")
                return False
        return False

    def test_patch_checkpoint_data(self):
        """Test PATCH endpoint for updating checkpoint data"""
        if not self.test_project_id:
            print("   ⚠️  Skipping - no project ID available")
            return False
        
        # Use the existing view ID
        existing_view_id = "e7b07a84-f096-4c51-b8e5-1c86d1e55a85"
        
        # Get a checkpoint field from the view
        success, view_response = self.run_test(
            "Get View for Checkpoint Field",
            "GET",
            f"custom-views/{existing_view_id}",
            200
        )
        
        if not success:
            return False
        
        checkpoint_columns = [col for col in view_response.get('columns', []) if col['field'].startswith('checkpoint_')]
        if not checkpoint_columns:
            print("   ⚠️  No checkpoint columns in view")
            return False
        
        checkpoint_field = checkpoint_columns[0]['field']
        
        # Test updating checkpoint value
        update_data = {
            "field": checkpoint_field,
            "value": True  # Set checkpoint to True (Sim)
        }
        
        success, response = self.run_test(
            "PATCH Checkpoint Data (Set to True)",
            "PATCH",
            f"custom-views/{existing_view_id}/data/{self.test_project_id}",
            200,
            data=update_data
        )
        
        if success:
            if response.get('success') and response.get('field') == checkpoint_field:
                print(f"   ✅ Checkpoint updated successfully")
                print(f"   Field: {response.get('field')}")
                print(f"   Old value: {response.get('old_value')}")
                print(f"   New value: {response.get('new_value')}")
                print(f"   Updated by: {response.get('updated_by')}")
                
                # Test updating back to False
                update_data_false = {
                    "field": checkpoint_field,
                    "value": False
                }
                
                success2, response2 = self.run_test(
                    "PATCH Checkpoint Data (Set to False)",
                    "PATCH",
                    f"custom-views/{existing_view_id}/data/{self.test_project_id}",
                    200,
                    data=update_data_false
                )
                
                if success2:
                    print(f"   ✅ Checkpoint updated back to False successfully")
                    return True
                else:
                    print(f"   ❌ Failed to update checkpoint back to False")
                    return False
            else:
                print(f"   ❌ Unexpected response structure")
                return False
        return False

    def test_cleanup(self):
        """Clean up created test data"""
        if self.created_view_id:
            success, _ = self.run_test(
                "Delete Test Public View",
                "DELETE",
                f"custom-views/{self.created_view_id}",
                204
            )
            if success:
                print("   ✅ Test public view cleaned up")
            return success
        return True

def main():
    print("🧪 Testing Sistema SAMIDEL - Comprehensive Custom Views Features")
    print("Testing: Role controls, checkpoint editing, PATCH endpoint")
    print("=" * 70)
    
    tester = ComprehensiveCustomViewsTester()
    
    # Test sequence
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1

    # Test 1: Create public view with role controls
    if not tester.test_create_public_view_with_roles():
        print("❌ Failed to create public view with role controls")
        return 1

    # Test 2: Create view with editable checkpoints
    if not tester.test_create_checkpoint_editable_view():
        print("❌ Failed to create view with editable checkpoints")
        return 1

    # Test 3: Get existing view data
    if not tester.test_get_existing_view_data():
        print("❌ Failed to get existing view data")
        return 1

    # Test 4: Test PATCH endpoint for checkpoint editing
    if not tester.test_patch_checkpoint_data():
        print("❌ Failed to test PATCH checkpoint data")
        return 1

    # Cleanup
    tester.test_cleanup()

    # Print results
    print(f"\n📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All comprehensive tests passed!")
        print("✅ Role controls working")
        print("✅ Checkpoint editing working") 
        print("✅ PATCH endpoint working")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())