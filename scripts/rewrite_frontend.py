"""Splice the backend-connected apiService + async GridProvider into the JSX source,
replacing the old mock store, client-side graph engine, and synchronous provider."""
SRC = '/home/z/my-project/scripts/fault-to-recovery.src.html'
API_BLOCK = open('/home/z/my-project/scripts/apiService_block.js').read().rstrip()
GP_BLOCK = open('/home/z/my-project/scripts/gridprovider_block.js').read().rstrip()

content = open(SRC).read()

# 1. Replace GRID_DATA_SEED + graph engine + old apiService with the new REST client.
start1 = content.index('const GRID_DATA_SEED = {')
end1_marker = '\n/* ---------------------------------------------------------------------\n   React Context'
end1 = content.index(end1_marker, start1)
content = content[:start1] + API_BLOCK + '\n' + content[end1:]

# 2. Replace the synchronous GridProvider with the async, backend-connected version.
start2 = content.index('function GridProvider({ children }) {')
end2_marker = '\n/* ---------------------------------------------------------------------\n   Shared UI primitives'
end2 = content.index(end2_marker, start2)
content = content[:start2] + GP_BLOCK + '\n' + content[end2:]

open(SRC, 'w').write(content)
print('Rewrote frontend source. New length:', len(content), 'chars')
# sanity: ensure no leftover mock references
for needle in ('GRID_DATA_SEED', 'recomputeGrid', 'computePoweredSet', 'downstreamNodes',
               'buildAdjacency', '_store:', '_init()', '_snap()'):
    if needle in content:
        print('WARNING: leftover reference to', needle)
print('Done.')
