import pandas as pd
import numpy as np

# Load your large file
df = pd.read_parquet('data.parquet')

# Calculate how many chunks you need (e.g., if 150MB, use 3 chunks)
num_chunks = 3 
chunks = np.array_split(df, num_chunks)

for i, chunk in enumerate(chunks):
    print(i)
    chunk.to_parquet(f'data_part_{i}.parquet')
