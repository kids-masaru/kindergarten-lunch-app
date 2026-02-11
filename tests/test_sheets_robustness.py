import sys
import os
import unittest
from unittest.mock import MagicMock, patch

# Add parent directory to path so we can import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.models import KindergartenMaster, ClassMaster, OrderData
from backend.sheets import records_to_models, find_col_index

class TestRobustness(unittest.TestCase):
    
    def test_find_col_index(self):
        """Test robust column finding with various headers."""
        headers = ['ID', 'Name', '  幼稚園ID  ', 'class #']
        
        # Exact match
        self.assertEqual(find_col_index(headers, ['ID']), 1)
        # Normalize spaces
        self.assertEqual(find_col_index(headers, ['幼稚園ID']), 3)
        # Normalize hash
        self.assertEqual(find_col_index(headers, ['class']), 4)
        # Not found
        self.assertIsNone(find_col_index(headers, ['NotExists']))

    def test_kindergarten_master_mapping(self):
        """Test mapping of KindergartenMaster from various row formats."""
        
        # Case 1: Standard English Keys
        row1 = {
            'kindergarten_id': 'K001',
            'name': 'Test Kindy',
            'login_id': 'user1',
            'password': 'pw1',
            'service_mon': 'TRUE'
        }
        models = records_to_models([row1], KindergartenMaster)
        self.assertEqual(len(models), 1)
        self.assertEqual(models[0].kindergarten_id, 'K001')
        self.assertTrue(models[0].service_mon)

        # Case 2: Japanese Keys (Legacy)
        row2 = {
            '幼稚園ID': 'K002',
            '幼稚園名': 'Test Kindy 2',
            'ログインID': 'user2',
            'パスワード': 'pw2',
            'service_mon': 'FALSE'
        }
        models = records_to_models([row2], KindergartenMaster)
        self.assertEqual(len(models), 1)
        self.assertEqual(models[0].kindergarten_id, 'K002')
        self.assertEqual(models[0].name, 'Test Kindy 2')
        self.assertFalse(models[0].service_mon)
        
        # Case 3: Mixed / Fuzzy
        row3 = {
            'id': 'K003', # Should map to kindergarten_id
            'name': 'Test Kindy 3',
            'login_id': 'user3',
            'password': 'pw3'
        }
        models = records_to_models([row3], KindergartenMaster)
        self.assertEqual(len(models), 1)
        self.assertEqual(models[0].kindergarten_id, 'K003')

    def test_class_master_mapping(self):
        """Test ClassMaster mapping."""
        row = {
            '幼稚園ID': 'K001',
            'クラス名': 'Sakura',
            '園児数': '20',
            'アレルギー数': '1'
        }
        models = records_to_models([row], ClassMaster)
        self.assertEqual(len(models), 1)
        self.assertEqual(models[0].kindergarten_id, 'K001')
        self.assertEqual(models[0].class_name, 'Sakura')
        self.assertEqual(models[0].default_student_count, 20)
        self.assertEqual(models[0].default_allergy_count, 1)

if __name__ == '__main__':
    unittest.main()
