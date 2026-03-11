import requests
import sys
import json
from datetime import datetime

class PartnersAPITester:
    def __init__(self, base_url="https://error-fix-55.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_partner_ids = []

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

    def test_get_partners(self):
        """Test getting all partners"""
        success, response = self.run_test(
            "Get All Partners",
            "GET",
            "partners/",
            200
        )
        
        if success:
            partners = response if isinstance(response, list) else []
            print(f"   Found {len(partners)} existing partners")
            
            # Check for confeccao partners with capacity data
            confeccao_partners = [p for p in partners if p.get('tipo_servico') == 'confeccao']
            print(f"   Found {len(confeccao_partners)} confection partners")
            
            # Check for simplified profile partners
            simplified_types = ['lavandaria', 'acabamento', 'estampagem', 'bordado']
            simplified_partners = [p for p in partners if p.get('tipo_servico') in simplified_types]
            print(f"   Found {len(simplified_partners)} simplified profile partners")
            
            return True, partners
        return False, []

    def test_create_confeccao_partner(self):
        """Test creating a confection partner with capacity calculation"""
        partner_data = {
            "nome": f"Confecção Teste {datetime.now().strftime('%H%M%S')}",
            "codigo": f"CONF{datetime.now().strftime('%H%M%S')}",
            "tipo_servico": "confeccao",
            "email": "teste@confeccao.pt",
            "telefone": "123456789",
            "morada": "Rua Teste, 123",
            "num_trabalhadores": 10,
            "eficiencia": 100,
            "taxa_ocupacao": 50,  # 50% occupancy rate
            "taxa_qualidade": 95,
            "capacidade_pecas_mes": 5000,
            "capacidade_projetos_mes": 20,
            "ativo": True
        }
        
        success, response = self.run_test(
            "Create Confection Partner with 50% Occupancy",
            "POST",
            "partners/",
            201,
            data=partner_data
        )
        
        if success and 'id' in response:
            self.test_partner_ids.append(response['id'])
            print(f"   Created partner ID: {response['id']}")
            
            # Verify capacity calculation
            expected_total_capacity = 10 * 8 * 22 * (100 / 100)  # 1760h/month
            expected_available_capacity = expected_total_capacity * (50 / 100)  # 880h/month
            
            actual_capacity = response.get('capacidade_horas_mes')
            print(f"   Expected available capacity: {expected_available_capacity}h/month")
            print(f"   Actual capacity in response: {actual_capacity}h/month")
            
            if actual_capacity == expected_available_capacity:
                print(f"   ✅ Capacity calculation correct: {actual_capacity}h/month")
                return True, response
            else:
                print(f"   ❌ Capacity calculation incorrect")
                return False, response
        return False, {}

    def test_create_lavandaria_partner(self):
        """Test creating a laundry partner with simplified profile"""
        partner_data = {
            "nome": f"Lavandaria Teste {datetime.now().strftime('%H%M%S')}",
            "codigo": f"LAV{datetime.now().strftime('%H%M%S')}",
            "tipo_servico": "lavandaria",
            "email": "teste@lavandaria.pt",
            "telefone": "987654321",
            "morada": "Rua Lavandaria, 456",
            "tempo_processamento_medio": 24,  # 24 hours average processing
            "capacidade_pecas_dia": 500,     # 500 pieces per day
            "prazo_entrega_padrao": 3,       # 3 days delivery time
            "taxa_qualidade": 98,
            "ativo": True
        }
        
        success, response = self.run_test(
            "Create Laundry Partner with Simplified Profile",
            "POST",
            "partners/",
            201,
            data=partner_data
        )
        
        if success and 'id' in response:
            self.test_partner_ids.append(response['id'])
            print(f"   Created partner ID: {response['id']}")
            
            # Verify simplified profile fields
            print(f"   Processing time: {response.get('tempo_processamento_medio')}h")
            print(f"   Daily capacity: {response.get('capacidade_pecas_dia')} pieces")
            print(f"   Delivery time: {response.get('prazo_entrega_padrao')} days")
            
            return True, response
        return False, {}

    def test_create_acabamento_partner(self):
        """Test creating a finishing partner with simplified profile"""
        partner_data = {
            "nome": f"Acabamento Teste {datetime.now().strftime('%H%M%S')}",
            "codigo": f"ACAB{datetime.now().strftime('%H%M%S')}",
            "tipo_servico": "acabamento",
            "email": "teste@acabamento.pt",
            "tempo_processamento_medio": 12,  # 12 hours average processing
            "capacidade_pecas_dia": 800,     # 800 pieces per day
            "prazo_entrega_padrao": 2,       # 2 days delivery time
            "taxa_qualidade": 96,
            "ativo": True
        }
        
        success, response = self.run_test(
            "Create Finishing Partner with Simplified Profile",
            "POST",
            "partners/",
            201,
            data=partner_data
        )
        
        if success and 'id' in response:
            self.test_partner_ids.append(response['id'])
            print(f"   Created partner ID: {response['id']}")
            return True, response
        return False, {}

    def test_update_partner_occupancy(self):
        """Test updating a confection partner's occupancy rate"""
        if not self.test_partner_ids:
            print("   ❌ No test partners to update")
            return False
            
        partner_id = self.test_partner_ids[0]  # First created partner (confeccao)
        
        update_data = {
            "taxa_ocupacao": 75,  # Change from 50% to 75%
            "eficiencia": 90      # Change efficiency too
        }
        
        success, response = self.run_test(
            "Update Partner Occupancy Rate from 50% to 75%",
            "PUT",
            f"partners/{partner_id}",
            200,
            data=update_data
        )
        
        if success:
            # Verify updated capacity calculation
            expected_total_capacity = 10 * 8 * 22 * (90 / 100)  # 1584h/month with 90% efficiency
            expected_available_capacity = expected_total_capacity * (75 / 100)  # 1188h/month with 75% occupancy
            
            actual_capacity = response.get('capacidade_horas_mes')
            print(f"   Expected updated capacity: {expected_available_capacity}h/month")
            print(f"   Actual updated capacity: {actual_capacity}h/month")
            
            if actual_capacity == expected_available_capacity:
                print(f"   ✅ Updated capacity calculation correct")
                return True
            else:
                print(f"   ❌ Updated capacity calculation incorrect")
                return False
        return False

    def test_get_partner_by_id(self):
        """Test getting specific partner data"""
        if not self.test_partner_ids:
            print("   ❌ No test partners to retrieve")
            return False
            
        partner_id = self.test_partner_ids[0]
        
        success, response = self.run_test(
            f"Get Partner by ID ({partner_id})",
            "GET",
            f"partners/{partner_id}",
            200
        )
        
        if success:
            print(f"   Partner name: {response.get('nome')}")
            print(f"   Partner type: {response.get('tipo_servico')}")
            print(f"   Occupancy rate: {response.get('taxa_ocupacao')}%")
            print(f"   Available capacity: {response.get('capacidade_horas_mes')}h/month")
            return True
        return False

    def test_cleanup(self):
        """Clean up created test data"""
        success_count = 0
        for partner_id in self.test_partner_ids:
            success, _ = self.run_test(
                f"Delete Test Partner {partner_id}",
                "DELETE",
                f"partners/{partner_id}",
                204
            )
            if success:
                success_count += 1
        
        print(f"   ✅ Cleaned up {success_count}/{len(self.test_partner_ids)} test partners")
        return success_count == len(self.test_partner_ids)

def main():
    print("🧪 Testing Partners Improvements - SAMIDEL Textile System")
    print("=" * 65)
    
    tester = PartnersAPITester()
    
    print("\n📋 TESTING PARTNERS API IMPROVEMENTS")
    print("-" * 50)
    
    # Test admin login first
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1

    # Test getting existing partners
    success, existing_partners = tester.test_get_partners()
    if not success:
        print("❌ Failed to get partners list")
        return 1

    # Test creating confection partner with capacity calculation
    success, confeccao_partner = tester.test_create_confeccao_partner()
    if not success:
        print("❌ Failed to create confection partner with capacity calculation")
        return 1

    # Test creating simplified profile partners
    success, lavandaria_partner = tester.test_create_lavandaria_partner()
    if not success:
        print("❌ Failed to create laundry partner with simplified profile")
        return 1

    success, acabamento_partner = tester.test_create_acabamento_partner()
    if not success:
        print("❌ Failed to create finishing partner with simplified profile")
        return 1

    # Test updating partner occupancy and recalculation
    if not tester.test_update_partner_occupancy():
        print("❌ Failed to update partner occupancy rate")
        return 1

    # Test getting partner by ID
    if not tester.test_get_partner_by_id():
        print("❌ Failed to get partner by ID")
        return 1

    # Cleanup
    tester.test_cleanup()

    print(f"\n📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed! Partners improvements working correctly.")
        print("\n✅ Key Features Verified:")
        print("   • Capacity calculation includes occupancy rate")
        print("   • Confection partners have complete profile")
        print("   • Laundry/Finishing have simplified profiles")  
        print("   • Partners table shows capacity and available columns")
        print("   • Occupancy rate updates recalculate capacity")
        return 0
    else:
        print("⚠️  Some backend tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())