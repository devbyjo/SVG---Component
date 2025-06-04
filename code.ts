figma.showUI(__html__, { width: 400, height: 320 });

// Helper function to resize node while maintaining aspect ratio
// Expects a node that has width, height, and resize properties (e.g., FrameNode)
function resizeWithAspectRatio(node: FrameNode | ComponentNode | InstanceNode | RectangleNode | EllipseNode | PolygonNode | StarNode | VectorNode | TextNode | GroupNode, targetWidth: number, targetHeight: number) {
  const originalWidth = node.width;
  const originalHeight = node.height;

  if (originalWidth === 0 || originalHeight === 0) {
    console.warn(`Node "${node.name}" has zero dimension, cannot maintain aspect ratio. Resizing to target.`);
    node.resize(targetWidth, targetHeight);
    return;
  }

  const scaleFactor = Math.min(targetWidth / originalWidth, targetHeight / originalHeight);
  node.resize(originalWidth * scaleFactor, originalHeight * scaleFactor);
}


figma.ui.onmessage = async (msg) => {
  if (msg.type === 'convert-svgs') {
    const svgs: { filename: string, svgContent: string }[] = msg.svgs;
    if (!svgs || svgs.length === 0) {
      figma.notify('No SVGs to convert.', { error: true });
      figma.ui.postMessage({ type: 'conversion-error', message: 'No SVGs received.' });
      return;
    }

    figma.ui.postMessage({ type: 'processing-status', message: `Starting conversion for ${svgs.length} SVG(s)...` });
    let componentsCreatedCount = 0;
    const allCreatedNodes: SceneNode[] = [];

    for (let i = 0; i < svgs.length; i++) {
      const svgData = svgs[i];
      const originalFilename = svgData.filename;
      const svgContent = svgData.svgContent;
      
      figma.ui.postMessage({ type: 'processing-status', message: `Processing ${originalFilename} (${i+1}/${svgs.length})...` });

      try {
        let baseName = originalFilename.replace(/\.svg$/i, ''); 
        baseName = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_'); 

        const componentSetName = `JP_${baseName}`;
        const variantComponents: ComponentNode[] = [];

        const processVariant = (variantName: string, setupFn: (variant: ComponentNode, svgNode: FrameNode) => void) => {
          const svgNode = figma.createNodeFromSvg(svgContent);
          if (svgNode.type !== "FRAME") { // createNodeFromSvg returns FrameNode
            console.error("SVG did not import as a FrameNode for", variantName);
            svgNode.remove(); // Clean up the unexpected node type
            throw new Error(`SVG for ${variantName} did not import as a FrameNode.`);
          }
          // Now svgNode is known to be a FrameNode
          resizeWithAspectRatio(svgNode, 20, 20);
          
          const variantComponent = figma.createComponent();
          variantComponent.name = `Style=${variantName}`;
          setupFn(variantComponent, svgNode); // Pass svgNode which is FrameNode
          variantComponent.appendChild(svgNode);
          variantComponents.push(variantComponent);
        };

        // --- Create Squarical Variant ---
        processVariant("Squarical", (variant, svgNode) => {
          variant.resize(36, 36);
          variant.paddingLeft = 8; variant.paddingRight = 8;
          variant.paddingTop = 8; variant.paddingBottom = 8;
          variant.cornerRadius = 8;
          variant.strokes = [{ type: 'SOLID', color: { r: 0.878, g: 0.878, b: 0.878 } }];
          variant.strokeWeight = 1;
          variant.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
          variant.layoutMode = 'HORIZONTAL'; 
          variant.primaryAxisAlignItems = 'CENTER';
          variant.counterAxisAlignItems = 'CENTER';
        });

        // --- Create Circular Variant ---
        processVariant("Circular", (variant, svgNode) => {
          variant.resize(36, 36);
          variant.paddingLeft = 8; variant.paddingRight = 8;
          variant.paddingTop = 8; variant.paddingBottom = 8;
          variant.cornerRadius = 40; 
          variant.strokes = [{ type: 'SOLID', color: { r: 0.878, g: 0.878, b: 0.878 } }];
          variant.strokeWeight = 1;
          variant.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
          variant.layoutMode = 'HORIZONTAL';
          variant.primaryAxisAlignItems = 'CENTER';
          variant.counterAxisAlignItems = 'CENTER';
        });

        // --- Create Borderless Variant ---
        processVariant("Borderless", (variant, svgNode) => {
          variant.resize(20, 20); 
          variant.fills = []; 
          variant.cornerRadius = 0;
          variant.layoutMode = 'HORIZONTAL';
          variant.primaryAxisAlignItems = 'CENTER';
          variant.counterAxisAlignItems = 'CENTER';
        });
        
        // --- Combine as Variants into a Component Set ---
        if (variantComponents.length === 3) {
          const componentSet = figma.combineAsVariants(variantComponents, figma.currentPage);
          componentSet.name = componentSetName;

          componentSet.layoutMode = 'VERTICAL'; 
          componentSet.itemSpacing = 24; 
          componentSet.primaryAxisSizingMode = 'AUTO'; 
          componentSet.counterAxisSizingMode = 'AUTO'; 
          componentSet.paddingLeft = 16; 
          componentSet.paddingRight = 16;
          componentSet.paddingTop = 16;
          componentSet.paddingBottom = 16;
          
          componentSet.x = figma.viewport.center.x + (componentsCreatedCount * (componentSet.width + 50)); 
          componentSet.y = figma.viewport.center.y;
          
          allCreatedNodes.push(componentSet);
          componentsCreatedCount++;
        } else {
            throw new Error("Not all variants were created successfully.");
        }

      } catch (e: any) {
        console.error(`Error processing ${originalFilename}:`, e.message, e.stack);
        figma.notify(`Error processing ${originalFilename}: ${e.message}`, { error: true });
        figma.ui.postMessage({ type: 'conversion-error', message: `Failed: ${originalFilename}. ${e.message}` });
      }
    }

    if (componentsCreatedCount > 0) {
      figma.currentPage.selection = allCreatedNodes;
      figma.viewport.scrollAndZoomIntoView(allCreatedNodes);
      const successMsg = `Successfully created ${componentsCreatedCount} component set(s).`;
      figma.notify(successMsg);
      figma.ui.postMessage({ type: 'conversion-complete', message: successMsg });
    } else if (svgs.length > 0) {
      const errorMsg = 'No components were created. Check console for errors.';
      figma.notify(errorMsg, { error: true });
      figma.ui.postMessage({ type: 'conversion-error', message: errorMsg });
    }
  }
};
