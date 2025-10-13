import { GLTFLoader } from "GLTFLoader";

export class DragDropManager {
  constructor(threeJsControl) {
    this.threeJsControl = threeJsControl;
    this.init();
  }

  init() {
    const tables = document.querySelectorAll('table.tl-table');
    
    tables.forEach((table) => {
      const headerTexts = Array.from(table.querySelectorAll('th')).map(h => {
        const span = h.querySelector('span[data-tooltip]');
        return span ? span.textContent.trim().toLowerCase() : h.textContent.trim().toLowerCase();
      });
      
      const hasName = headerTexts.some(text => text.includes('name'));
      const hasFile = headerTexts.some(text => text.includes('jt') || text.includes('file'));
      const hasTransformation = headerTexts.some(text => text.includes('transformation'));
      const hasAsset = headerTexts.some(text => text.includes('asset'));
      
      // Assets table: has Name and File columns
      if (hasName && hasFile) {
        this.setupAssetTableDragHandlers(table);
      } 
      // Scene table: has Transformation and Asset columns
      else if (hasTransformation && hasAsset) {
        this.setupSceneTableDropHandlers(table);
      }
    });
  }

  setupAssetTableDragHandlers(table) {
    table.querySelectorAll('tbody tr').forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      
      // Find file cell (contains file extensions)
      const fileCell = cells.find(cell => {
        const text = cell.textContent.trim();
        return text.includes('.jt') || text.includes('.gltf') || text.includes('.glb');
      });
      
      // Find name cell (first non-empty cell without input/transformation data)
      const nameCell = cells.find(cell => {
        const text = cell.textContent.trim();
        return text && !cell.querySelector('input') && !text.includes('M(') && !text.includes('T(');
      });
      
      if (!nameCell) return;
      
      const assetName = nameCell.textContent.trim();
      if (!assetName) return;
      
      row.draggable = true;
      
      row.addEventListener('dragstart', (e) => {
        let filePath = fileCell ? fileCell.textContent.trim() : `/assets/${assetName}/${assetName}.gltf`;
        
        // Normalize path
        if (!filePath.startsWith('/assets/') && !filePath.startsWith('http')) {
          filePath = `/assets/${filePath}`;
        }
        
        // Convert .jt to .glb
        if (filePath.toLowerCase().endsWith('.jt')) {
          filePath = filePath.replace(/\.jt$/i, '.glb');
        }
        
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'asset',
          name: assetName,
          filePath: filePath
        }));
        e.dataTransfer.effectAllowed = 'copy';
        
        row.style.opacity = '0.5';
        row.style.backgroundColor = '#e3f2fd';
      });

      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
        row.style.backgroundColor = '';
      });
    });
  }

  setupSceneTableDropHandlers(table) {
    const tableBody = table.querySelector('tbody');
    const isOverTable = (element) => element.closest('table') === table;
    const resetBackground = () => tableBody.style.backgroundColor = '';
    
    document.addEventListener('dragover', (e) => {
      if (isOverTable(e.target)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        tableBody.style.backgroundColor = '#e8f5e8';
      }
    });
    
    document.addEventListener('drop', (e) => {
      if (isOverTable(e.target)) {
        e.preventDefault();
        resetBackground();
        
        try {
          const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
          if (dragData.type === 'asset') {
            this.loadAndCreateAsset(dragData);
          }
        } catch (error) {
          console.error('Error handling drop:', error);
        }
      }
    });
    
    document.addEventListener('dragleave', (e) => {
      if (isOverTable(e.target) && !tableBody.contains(e.relatedTarget)) {
        resetBackground();
      }
    });
  }

  loadAndCreateAsset(assetData) {
    if (!this.threeJsControl?.scope) {
      return;
    }
    
    // Use the file path directly from the Assets table
    // It's already processed in dragstart handler:
    // - Prefixed with /assets/ if needed
    // - .jt extension converted to .glb
    const assetUrl = assetData.filePath;
    const gltfLoader = new GLTFLoader();
    const fullUrl = this.threeJsControl.contextPath + assetUrl;
    
    gltfLoader.load(
      fullUrl,
      (gltf) => {
        this.threeJsControl.createGltfAssetFromDrop(assetData.name, assetUrl, gltf);
      },
      undefined,
      (error) => {
        console.error('Error loading GLTF:', error);
      }
    );
  }
}